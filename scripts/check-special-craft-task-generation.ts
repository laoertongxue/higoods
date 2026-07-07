#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import {
  DICTIONARY_CRAFT_MOCKS_PER_DEFINITION,
  generateProductionArtifactBundleForOrder,
  listGeneratedProductionDemandArtifacts,
  listGeneratedProductionTaskArtifacts,
} from '../src/data/fcs/production-artifact-generation.ts'
import { listActiveProcessCraftDefinitions } from '../src/data/fcs/process-craft-dict.ts'
import { buildProductionConfirmationSnapshot } from '../src/data/fcs/production-confirmation.ts'
import {
  buildSpecialCraftOperationSlug,
  getSpecialCraftOperationById,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftGenerationBatchByOrderId,
  getSpecialCraftTaskOrderById,
  getSpecialCraftTasksByProductionOrder,
  listSpecialCraftTaskOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  buildSpecialCraftTaskDemandLinesFromProductionOrder,
  generateSpecialCraftTaskOrdersFromProductionOrder,
} from '../src/data/fcs/special-craft-task-generation.ts'
import { shouldGenerateInternalCraftOrderForProductionOrder } from '../src/data/fcs/task-generation-boundaries.ts'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import {
  listPrepProcessOrders,
  listPrepRequirementDemands,
} from '../src/data/fcs/page-adapters/process-prep-pages-adapter.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listProcessWorkOrders } from '../src/data/fcs/process-work-order-domain.ts'
import { processTasks } from '../src/data/fcs/process-tasks.ts'
import { listRuntimeProcessTasks } from '../src/data/fcs/runtime-process-tasks.ts'
import { renderSpecialCraftTaskDetailPage } from '../src/pages/process-factory/special-craft/task-detail.ts'
import { renderSpecialCraftTaskOrdersPage } from '../src/pages/process-factory/special-craft/task-orders.ts'
import { routes as fcsRoutes } from '../src/router/routes-fcs.ts'
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
void fcsRoutes
const generatorSource = read('src/data/fcs/special-craft-task-generation.ts')
const artifactSource = read('src/data/fcs/production-artifact-generation.ts')
const taskOrdersSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const taskDetailSource = read('src/pages/process-factory/special-craft/task-detail.ts')
const warehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const taskOrderDataSource = read('src/data/fcs/special-craft-task-orders.ts')
const pdaWarehouseSource = read('src/pages/pda-warehouse.ts')
const handoverSource = read('src/pages/pda-handover.ts')
const confirmationSource = read('src/data/fcs/production-confirmation.ts')
const taskBreakdownSource = read('src/pages/task-breakdown.ts')
const feiTicketFlowSource = read('src/data/fcs/cutting/special-craft-fei-ticket-flow.ts')

assertContains(packageSource, 'check:special-craft-task-generation', 'package.json 缺少生产单特殊工艺任务生成检查命令')
assertContains(generatorSource, 'buildSpecialCraftTaskDemandLinesFromProductionOrder', '缺少特殊工艺需求明细构建器')
assertContains(generatorSource, 'generateSpecialCraftTaskOrdersFromProductionOrder', '缺少特殊工艺任务生成器')
assertContains(generatorSource, 'getSpecialCraftGenerationKey', '缺少特殊工艺任务幂等键')
assertContains(generatorSource, 'attachSpecialCraftTasksToProductionArtifacts', '缺少特殊工艺任务接入生产单产物 helper')
assertContains(feiTicketFlowSource, 'buildSpecialCraftFeiTicketBindingsFromGeneratedFeiTickets', '缺少 Prompt 7 菲票绑定适配层')
assertNotContains(feiTicketFlowSource, 'generateSpecialCraftTaskOrdersFromProductionOrder', '菲票绑定层不应重新生成特殊工艺任务')
assertNotContains(feiTicketFlowSource, 'buildSpecialCraftTaskDemandLinesFromProductionOrder', '菲票绑定层不应重新生成特殊工艺任务明细')
assertContains(taskOrderDataSource, 'SpecialCraftTaskWorkOrder', '特殊工艺任务数据层必须保留父任务并新增子工艺单')
assertContains(taskOrderDataSource, 'buildSpecialCraftTaskWorkOrders', '特殊工艺任务生成后必须可拆子工艺单')
assertContains(taskOrderDataSource, 'syncSpecialCraftTaskOrderAggregatesFromWorkOrders', '父任务聚合必须能从子工艺单同步')
assertContains(generatorSource, 'patternFiles', '生成器未读取技术包快照纸样文件')
assertContains(generatorSource, 'pieceRows', '生成器未读取裁片明细')
assertContains(generatorSource, 'specialCrafts', '生成器未读取裁片特殊工艺')
assertContains(generatorSource, 'craft.selectedTargetObject', '生成器必须读取技术包本次选择的作用对象')
assertContains(generatorSource, 'resolveSelectedTargetObject', '生成器必须解析技术包特殊工艺作用对象')
assertContains(generatorSource, 'isSpecialCraftTargetObjectSupported', '生成器必须校验作用对象是否在字典支持范围内')
assertContains(generatorSource, 'getDemandLineUnit(selectedTargetObject)', '生成器必须按作用对象确定任务明细单位')
assertContains(generatorSource, 'colorAllocations', '生成器未读取适用颜色与片数')
assertContains(generatorSource, 'skuLines', '生成器未读取生产单颜色尺码数量矩阵')
assertContains(generatorSource, 'planPieceQty: pieceCountPerGarment * orderQty', '计划片数计算公式不正确')
assertContains(artifactSource, 'generateProductionArtifactBundleForOrder', '生产单生成链路缺少特殊工艺任务 bundle 接口')
assertContains(artifactSource, 'specialCraftTaskOrders', '生产单生成链路未接入特殊工艺任务')
assertNotContains(taskOrdersSource, buildToken('新', '增任务'), '特殊工艺加工单页面不应提供手工新增入口')
assertNotContains(taskOrdersSource, buildToken('生', '成任务'), '特殊工艺加工单页面不应提供手工生成入口')
assertNotContains(taskOrdersSource, buildToken('从', '裁片仓', '生成'), '特殊工艺加工单页面不应提供裁片仓转任务入口')
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
const hasPieceSpecialCraftConfig = snapshot.patternFiles.some((row) =>
  row.pieceRows.some((piece) => (piece.specialCrafts ?? []).length > 0),
)
const hasGarmentSpecialCraftConfig = snapshot.processEntries.some((entry) =>
  entry.processCode === 'SPECIAL_CRAFT' && Boolean(entry.craftCode) && entry.selectedTargetObject === '成衣半成品',
)
assert(
  hasPieceSpecialCraftConfig || hasGarmentSpecialCraftConfig,
  '技术包快照必须在裁片明细或工序工艺中标记特殊工艺',
)

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
assert(demandBuildResult.demandLines.every((line) => line.targetObject === '已裁部位' || line.targetObject === '完整面料' || line.targetObject === '裁片' || line.targetObject === '面料' || line.targetObject === '成衣半成品'), '任务明细必须承接技术包选择的作用对象')

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
assert(storeTasks.length === firstResult.taskOrders.length, '特殊工艺加工单数据源必须读取自动产出任务')
const allStoreTasks = listSpecialCraftTaskOrders()
assert(allStoreTasks.length > 0, '特殊工艺加工单数据源必须存在生产单自动产出任务')
assert(allStoreTasks.every((task) => task.generationSource === 'PRODUCTION_ORDER'), '特殊工艺加工单数据源不得混入原型 seed 或手工任务')
assert(allStoreTasks.every((task) => productionOrders.some((order) => order.productionOrderId === task.productionOrderId)), '特殊工艺任务必须关联已有生产单')
assert(
  allStoreTasks.every((task) => {
    const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
    return Boolean(order && shouldGenerateInternalCraftOrderForProductionOrder(order))
  }),
  '特殊工艺加工单列表只能包含我方内部加工对象',
)
assert(allStoreTasks.every((task) => Boolean(getProductionOrderTechPackSnapshot(task.productionOrderId))), '特殊工艺任务必须关联已有生产单的技术包快照')
const activeCraftDefinitions = listActiveProcessCraftDefinitions()
const taskCraftDefinitions = activeCraftDefinitions.filter((definition) => definition.defaultDocType === 'TASK')
const demandCraftDefinitions = activeCraftDefinitions.filter((definition) => definition.defaultDocType === 'DEMAND')
const generatedTaskArtifacts = listGeneratedProductionTaskArtifacts()
const generatedDemandArtifacts = listGeneratedProductionDemandArtifacts()

function countByCraftCode(items: Array<{ craftCode?: string }>): Map<string, number> {
  const counts = new Map<string, number>()
  items.forEach((item) => {
    if (!item.craftCode) return
    counts.set(item.craftCode, (counts.get(item.craftCode) ?? 0) + 1)
  })
  return counts
}

function countByProcessTaskCraftCoverage(items: typeof processTasks): Map<string, number> {
  const counts = new Map<string, number>()
  items.forEach((task) => {
    const craftCodes = new Set<string>()
    if (task.craftCode) craftCodes.add(task.craftCode)
    task.coveredProcesses?.forEach((process) => {
      if (process.craftCode) craftCodes.add(process.craftCode)
    })
    craftCodes.forEach((craftCode) => {
      counts.set(craftCode, (counts.get(craftCode) ?? 0) + 1)
    })
  })
  return counts
}

const taskArtifactCounts = countByCraftCode(generatedTaskArtifacts)
const demandArtifactCounts = countByCraftCode(generatedDemandArtifacts)
const processTaskCounts = countByProcessTaskCraftCoverage(processTasks)
taskCraftDefinitions.forEach((definition) => {
  assert(
    (taskArtifactCounts.get(definition.craftCode) ?? 0) >= DICTIONARY_CRAFT_MOCKS_PER_DEFINITION,
    `工艺 ${definition.processCode}/${definition.craftName} 必须至少有 3 条任务产物`,
  )
  assert(
    (processTaskCounts.get(definition.craftCode) ?? 0) >= DICTIONARY_CRAFT_MOCKS_PER_DEFINITION,
    `工艺 ${definition.processCode}/${definition.craftName} 必须至少有 3 条任务 mock`,
  )
})
demandCraftDefinitions.forEach((definition) => {
  assert(
    (demandArtifactCounts.get(definition.craftCode) ?? 0) >= DICTIONARY_CRAFT_MOCKS_PER_DEFINITION,
    `工艺 ${definition.processCode}/${definition.craftName} 必须至少有 3 条需求单 mock`,
  )
})
const processTaskCoverageCount = [...processTaskCounts.values()].reduce((sum, count) => sum + count, 0)
assert(
  processTaskCoverageCount >= taskCraftDefinitions.length * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION,
  '工序工艺任务 mock 覆盖次数必须覆盖全部字典任务工艺',
)
assert(processTasks.every((task) => productionOrders.some((order) => order.productionOrderId === task.productionOrderId)), '工序工艺任务必须关联已有生产单')
assert(processTasks.every((task) => Boolean(getProductionOrderTechPackSnapshot(task.productionOrderId))), '工序工艺任务必须关联已有生产单技术包快照')
assert(processTasks.some((task) => task.isSpecialCraft && task.craftName === '烫画'), '工序工艺任务必须包含烫画特殊工艺')
assert(processTasks.some((task) => task.woolTaskType === 'WHOLE_GARMENT'), '工序工艺任务必须包含整件毛织')
assert(processTasks.some((task) => task.woolTaskType === 'PART_PANEL'), '工序工艺任务必须包含部位毛织')

const runtimeTaskCoverageKeys = new Set(
  listRuntimeProcessTasks().flatMap((task) => [
    task.taskId,
    task.baseTaskId,
    task.taskNo,
    task.rootTaskNo,
    ...(task.mergeSourceTaskIds ?? []),
    ...(task.mergeSourceTaskIds ?? []).map((taskId) => taskId.replace(/__.*/, '')),
  ].filter((value): value is string => Boolean(value))),
)
assert(
  processTasks.every((task) => runtimeTaskCoverageKeys.has(task.taskId) || runtimeTaskCoverageKeys.has(task.taskNo ?? '')),
  'FCS 路由加载后运行时工序工艺任务必须承接全部字典任务 mock',
)

const productionOrderIds = new Set(productionOrders.map((order) => order.productionOrderId))
function assertExistingProductionOrderWithSnapshot(productionOrderId: string, message: string): void {
  assert(productionOrderIds.has(productionOrderId), message)
  assert(getProductionOrderTechPackSnapshot(productionOrderId), `${message}，且必须存在技术包快照`)
}

const printWorkOrders = listPrintWorkOrders()
const dyeWorkOrders = listDyeWorkOrders()
const printProcessWorkOrders = listProcessWorkOrders('PRINT')
const dyeProcessWorkOrders = listProcessWorkOrders('DYE')
const printDemands = listPrepRequirementDemands('PRINT')
const dyeDemands = listPrepRequirementDemands('DYE')
const printPrepOrders = listPrepProcessOrders('PRINT')
const dyePrepOrders = listPrepProcessOrders('DYE')

const expectedPrintCount = demandCraftDefinitions.filter((definition) => definition.processCode === 'PRINT').length * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION
const expectedDyeCount = demandCraftDefinitions.filter((definition) => definition.processCode === 'DYE').length * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION
assert(printWorkOrders.length >= expectedPrintCount, '印花加工单 mock 数据必须覆盖印花字典工艺，每个至少 3 条')
assert(dyeWorkOrders.length >= expectedDyeCount, '染色加工单 mock 数据必须覆盖染色字典工艺，每个至少 3 条')
assert(printProcessWorkOrders.length >= expectedPrintCount, '统一印花加工单 mock 数据必须覆盖印花字典工艺，每个至少 3 条')
assert(dyeProcessWorkOrders.length >= expectedDyeCount, '统一染色加工单 mock 数据必须覆盖染色字典工艺，每个至少 3 条')
assert(printDemands.length >= expectedPrintCount, '印花需求 mock 数据必须覆盖印花字典工艺，每个至少 3 条')
assert(dyeDemands.length >= expectedDyeCount, '染色需求 mock 数据必须覆盖染色字典工艺，每个至少 3 条')
assert(printPrepOrders.length >= expectedPrintCount, 'Web 印花加工单 mock 数据必须覆盖印花字典工艺，每个至少 3 条')
assert(dyePrepOrders.length >= expectedDyeCount, 'Web 染色加工单 mock 数据必须覆盖染色字典工艺，每个至少 3 条')

const printDemandIds = new Set(printDemands.map((demand) => demand.demandId))
const dyeDemandIds = new Set(dyeDemands.map((demand) => demand.demandId))
printDemands.forEach((demand) => {
  assertExistingProductionOrderWithSnapshot(demand.sourceProductionOrderId, '印花需求必须来源于已有生产单')
  assert(demand.demandId.startsWith('YHXQ'), '印花需求单号必须由生产单生成')
  assert(!demand.demandId.includes('PRD-PRINT'), '印花需求不得继续使用旧 seed 需求号')
})
dyeDemands.forEach((demand) => {
  assertExistingProductionOrderWithSnapshot(demand.sourceProductionOrderId, '染色需求必须来源于已有生产单')
  assert(demand.demandId.startsWith('RSXQ'), '染色需求单号必须由生产单生成')
  assert(!demand.demandId.includes('DM-DYE'), '染色需求不得继续使用旧 seed 需求号')
})
printWorkOrders.forEach((order) => {
  assert(order.productionOrderIds.length === 1, '印花加工单必须精确关联一个已有生产单')
  assertExistingProductionOrderWithSnapshot(order.productionOrderIds[0], '印花加工单必须来源于已有生产单')
  assert(order.sourceDemandIds.every((demandId) => printDemandIds.has(demandId)), '印花加工单必须关联 Web 印花需求')
  assert(order.printOrderNo.startsWith('YHJG'), '印花加工单号必须由生产单生成')
})
dyeWorkOrders.forEach((order) => {
  assert(order.productionOrderIds?.length === 1, '染色加工单必须精确关联一个已有生产单')
  assertExistingProductionOrderWithSnapshot(order.productionOrderIds![0], '染色加工单必须来源于已有生产单')
  assert(order.sourceDemandIds.every((demandId) => dyeDemandIds.has(demandId)), '染色加工单必须关联 Web 染色需求')
  assert(order.dyeOrderNo.startsWith('RSJG'), '染色加工单号必须由生产单生成')
})

const sampleTask = storeTasks[0]
assert(sampleTask, '必须能在任务单数据源中找到自动产出任务')
assert(getSpecialCraftTaskOrderById(sampleTask.taskOrderId), '必须能根据任务号读取自动产出任务详情')
assert(getSpecialCraftGenerationBatchByOrderId(sampleOrder.productionOrderId), '必须能根据生产单读取生成批次')

const operationSlug = buildSpecialCraftOperationSlug(sampleTask.operationId)
const taskOrdersHtml = renderSpecialCraftTaskOrdersPage(operationSlug)
assert(taskOrdersHtml.includes(sampleTask.taskOrderNo), '特殊工艺加工单页面必须显示自动产出任务')
assert(taskOrdersHtml.includes('生产单生成'), '特殊工艺加工单页面必须显示任务来源')
assert(taskOrdersHtml.includes('明细数'), '特殊工艺加工单页面必须显示明细数字段')
assert(taskOrdersHtml.includes('分配状态'), '特殊工艺加工单页面必须显示分配状态')
assert(taskOrdersHtml.includes('执行状态'), '特殊工艺加工单页面必须显示执行状态')

const taskDetailHtml = renderSpecialCraftTaskDetailPage(operationSlug, sampleTask.taskOrderId)
;['任务明细', '来源纸样', '来源裁片明细', '技术包版本', '生成批次', '分配状态', '执行状态', '待绑定'].forEach((token) => {
  assert(taskDetailHtml.includes(token), `特殊工艺任务详情页缺少：${token}`)
})

;['任务清单', '任务总数', '任务流程', 'data-breakdown-field="keyword"'].forEach((token) => {
  assertContains(taskBreakdownSource, token, `任务拆解页源码缺少：${token}`)
})

const confirmationSnapshot = buildProductionConfirmationSnapshot(sampleOrder.productionOrderId)
assert(confirmationSnapshot.taskAssignmentSnapshot.some((row) => row.taskNo === sampleTask.taskOrderNo), '生产确认单快照必须包含特殊工艺任务')
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
  assertNotContains(taskOrdersSource + taskDetailSource, token, `页面用户可见文案不应出现：${token}`)
})

;[
  buildToken('bind', 'Fei'),
  buildToken('生成', '菲票'),
  buildToken('绑定', '菲票'),
].forEach((token) => {
  assertNotContains(generatorSource, token, `本轮不应出现菲票提前处理：${token}`)
})

;[
  buildToken('axi', 'os'),
  buildToken('fet', 'ch('),
  buildToken('api', 'Client'),
  buildToken('/', 'api', '/'),
  buildToken('i1', '8n'),
  buildToken('use', 'Translation'),
  buildToken('loc', 'ales'),
  buildToken('trans', 'lations'),
].forEach((token) => {
  assertNotContains(generatorSource + taskOrdersSource + taskDetailSource, token, `本轮不应越界到接口或多语言：${token}`)
})

console.log('check:special-craft-task-generation passed')
