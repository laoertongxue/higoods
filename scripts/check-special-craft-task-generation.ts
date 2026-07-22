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
  listGeneratedProductionTaskArtifacts,
} from '../src/data/fcs/production-artifact-generation.ts'
import { listActiveProcessCraftDefinitions } from '../src/data/fcs/process-craft-dict.ts'
import { resolveTechPackProcessEntryRule } from '../src/data/fcs/tech-packs.ts'
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
  type SpecialCraftTaskGenerationError,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  buildSpecialCraftTaskDemandLinesFromProductionOrder,
  generateSpecialCraftTaskOrdersFromProductionOrder,
} from '../src/data/fcs/special-craft-task-generation.ts'
import { shouldGenerateInternalCraftOrderForProductionOrder } from '../src/data/fcs/task-generation-boundaries.ts'
import { buildSpecialCraftFeiTicketBindingsFromGeneratedFeiTickets } from '../src/data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { listPrepProcessOrders } from '../src/data/fcs/page-adapters/process-prep-pages-adapter.ts'
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

const validatedGenerationErrorTypes: SpecialCraftTaskGenerationError['errorType'][] = [
  '生产SKU重复',
  '成衣BOM适用SKU缺失',
  '成衣BOM适用SKU无生产数量',
]
assert.equal(new Set(validatedGenerationErrorTypes).size, 3, '新增生成阻断错误必须纳入统一错误类型契约')

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
  entry.processCode === 'SPECIAL_CRAFT' && Boolean(entry.craftCode) && entry.selectedTargetObject === '成衣',
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
assert(demandBuildResult.demandLines.every((line) => line.targetObject === '成衣' || (line.patternFileId.trim().length > 0 && line.patternFileName.trim().length > 0)), '裁片任务明细必须包含来源纸样')
assert(demandBuildResult.demandLines.every((line) => line.targetObject === '成衣' || line.pieceRowId.trim().length > 0), '裁片任务明细必须包含来源裁片明细')
assert(demandBuildResult.demandLines.every((line) => Array.isArray(line.feiTicketNos) && line.feiTicketNos.length === 0), '任务生成时菲票字段必须允许为空')
assert(demandBuildResult.demandLines.every((line) => line.targetObject === '已裁部位' || line.targetObject === '完整面料' || line.targetObject === '裁片' || line.targetObject === '面料' || line.targetObject === '成衣'), '任务明细必须承接技术包选择的作用对象')

const garmentOrder = productionOrders.find((order) =>
  getProductionOrderTechPackSnapshot(order.productionOrderId)?.processEntries.some(
    (entry) => entry.craftName === '烫画' && entry.selectedTargetObject === '成衣',
  ),
)
assert(garmentOrder, '缺少可验证成衣烫画旧快照迁移的生产单')
const garmentSnapshot = getProductionOrderTechPackSnapshot(garmentOrder.productionOrderId)
assert(garmentSnapshot, '成衣烫画生产单缺少技术包快照')
const formalGarmentEntry = garmentSnapshot.processEntries.find(
  (entry) => entry.craftName === '烫画' && entry.selectedTargetObject === '成衣',
)
const formalGarmentBom = garmentSnapshot.bomItems.find(
  (item) => item.type === '成衣' && formalGarmentEntry?.linkedBomItemIds?.includes(item.id),
)
assert(formalGarmentBom, '正式成衣烫画快照缺少关联成衣 BOM')
assert.equal(formalGarmentBom.unit, '件', '成衣 BOM 单位必须为件')
assert.equal(formalGarmentBom.unitConsumption, 1, '成衣 BOM 单位用量必须为 1')
assert.equal(formalGarmentBom.lossRate, 0, '成衣 BOM 损耗率必须为 0')
assert.deepEqual(formalGarmentBom.linkedPatternIds ?? [], [], '成衣 BOM 不得关联纸样')
assert(
  !garmentSnapshot.colorMaterialMappings.some((mapping) =>
    mapping.lines.some((line) => line.bomItemId === formalGarmentBom.id),
  ),
  '成衣 BOM 不得生成面料专属的颜色物料纸样关联',
)
const legacyGarmentSnapshot = JSON.parse(JSON.stringify(garmentSnapshot)) as typeof garmentSnapshot
const legacyGarmentEntry = legacyGarmentSnapshot.processEntries.find((entry) => entry.craftName === '烫画')
assert(legacyGarmentEntry, '成衣烫画技术包快照缺少烫画工艺')
const legacySourceBom = legacyGarmentSnapshot.bomItems[0]
const legacyApplicableSku = garmentOrder.demandSnapshot.skuLines[0]
assert(legacySourceBom && legacyApplicableSku, '成衣烫画旧快照迁移用例缺少 BOM 或生产 SKU')
const legacyGarmentBomId = 'BOM-LEGACY-GARMENT'
legacyGarmentSnapshot.bomItems.push({
  ...legacySourceBom,
  id: legacyGarmentBomId,
  type: '成衣',
  name: '成衣',
  unit: '件',
  unitConsumption: 1,
  lossRate: 0,
  applicableSkuCodes: [legacyApplicableSku.skuCode],
})
;(legacyGarmentEntry as unknown as { selectedTargetObject: string }).selectedTargetObject = '成衣半成品'
;(legacyGarmentEntry as unknown as { supportedTargetObjectLabels: string[] }).supportedTargetObjectLabels = ['已裁部位', '成衣半成品']
legacyGarmentEntry.linkedBomItemIds = [legacyGarmentBomId]
const migratedGarmentDemand = buildSpecialCraftTaskDemandLinesFromProductionOrder({
  productionOrder: garmentOrder,
  techPackSnapshot: legacyGarmentSnapshot,
})
assert(migratedGarmentDemand.demandLines.length > 0, '旧快照的成衣烫画仍必须能生成任务明细')
assert(migratedGarmentDemand.demandLines.every((line) => line.targetObject === '成衣'), '旧快照作用对象必须迁移为成衣')
assert(migratedGarmentDemand.demandLines.every((line) => line.unit === '件'), '成衣烫画明细单位必须为件')
assert(!JSON.stringify(migratedGarmentDemand.demandLines).includes('成衣半成品'), '旧快照迁移后不得继续输出旧标签')

const resolvedGarmentEntry = resolveTechPackProcessEntryRule(legacyGarmentEntry)
assert.equal(resolvedGarmentEntry.selectedTargetObject, '成衣', '新保存工艺作用对象必须为成衣')
assert.deepEqual(resolvedGarmentEntry.supportedTargetObjectLabels, ['已裁部位', '成衣'], '新保存支持对象不得写回旧标签')
assert(!JSON.stringify(resolvedGarmentEntry).includes('成衣半成品'), '规范化工艺不得包含旧标签')

const directPrintDefinition = listActiveProcessCraftDefinitions().find((definition) => definition.craftName === '直喷')
const heatTransferDefinition = listActiveProcessCraftDefinitions().find((definition) => definition.craftName === '烫画')
assert(directPrintDefinition && heatTransferDefinition, '双对象生成用例缺少直喷或烫画字典')
const dualTargetSnapshot = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot
const dualTargetOrder = JSON.parse(JSON.stringify(sampleOrder)) as typeof sampleOrder
const applicableSku = dualTargetOrder.demandSnapshot.skuLines[0]
assert(applicableSku, '双对象生成用例缺少生产 SKU 数量')
const sourceBom = dualTargetSnapshot.bomItems[0]
assert(sourceBom, '双对象生成用例缺少可复制的 BOM 行')
const garmentBomId = 'BOM-DUAL-TARGET-GARMENT'
dualTargetSnapshot.bomItems.push({
  ...sourceBom,
  id: garmentBomId,
  type: '成衣',
  name: '成衣',
  unit: '件',
  unitConsumption: 1,
  lossRate: 0,
  applicableSkuCodes: [applicableSku.skuCode],
})
dualTargetSnapshot.processEntries = dualTargetSnapshot.processEntries
  .filter((entry) => entry.craftName !== '直喷' && entry.craftName !== '烫画')
  .concat([
    {
      ...legacyGarmentEntry,
      id: 'ENTRY-DUAL-HEAT-TRANSFER-GARMENT',
      craftCode: heatTransferDefinition.craftCode,
      craftName: '烫画',
      selectedTargetObject: '成衣',
      linkedBomItemIds: [garmentBomId],
    },
    {
      ...legacyGarmentEntry,
      id: 'ENTRY-DUAL-DIRECT-PRINT-GARMENT',
      craftCode: directPrintDefinition.craftCode,
      craftName: '直喷',
      selectedTargetObject: '成衣',
      linkedBomItemIds: [garmentBomId],
    },
  ])
const dualTargetPiece = dualTargetSnapshot.patternFiles
  .flatMap((patternFile) => patternFile.pieceRows)
  .find((pieceRow) => pieceRow.name && (pieceRow.colorAllocations ?? []).some((allocation) => allocation.pieceCount > 0))
assert(dualTargetPiece, '双对象生成用例缺少真实纸样裁片和颜色片数')
dualTargetPiece.specialCrafts = [
  {
    processCode: 'SPECIAL_CRAFT',
    processName: '辅助工艺',
    craftCode: heatTransferDefinition.craftCode,
    craftName: '烫画',
    displayName: '烫画',
    selectedTargetObject: '已裁部位',
    supportedTargetObjects: ['CUT_PIECE', 'SEMI_FINISHED_GARMENT'],
    supportedTargetObjectLabels: ['已裁部位', '成衣'],
  },
  {
    processCode: 'SPECIAL_CRAFT',
    processName: '辅助工艺',
    craftCode: directPrintDefinition.craftCode,
    craftName: '直喷',
    displayName: '直喷',
    selectedTargetObject: '已裁部位',
    supportedTargetObjects: ['CUT_PIECE', 'SEMI_FINISHED_GARMENT'],
    supportedTargetObjectLabels: ['已裁部位', '成衣'],
  },
]
const dualTargetResult = generateSpecialCraftTaskOrdersFromProductionOrder({
  productionOrder: dualTargetOrder,
  techPackSnapshot: dualTargetSnapshot,
})
assert.equal(dualTargetResult.errors.length, 0, '直喷和烫画双对象快照不应产生阻塞错误')
for (const craftName of ['直喷', '烫画'] as const) {
  const craftTasks = dualTargetResult.taskOrders.filter((task) => task.craftName === craftName)
  const cutPiece = craftTasks.find((task) => task.targetObject === '已裁部位')
  const garment = craftTasks.find((task) => task.targetObject === '成衣')
  assert(cutPiece && garment, `${craftName} 必须分别生成裁片和成衣任务`)
  assert.equal(cutPiece.unit, '片')
  assert(cutPiece.demandLines?.every((line) => Boolean(line.patternFileId && line.pieceRowId)), `${craftName} 裁片明细必须保留真实纸样和部位`)
  assert.equal(garment.unit, '件')
  assert.equal(garment.planQty, applicableSku.qty, `${craftName} 成衣数量只能取成衣 BOM 适用 SKU`)
  assert(garment.demandLines?.every((line) => line.sourceBomItemId === garmentBomId), `${craftName} 成衣明细必须保存来源 BOM 行`)
  assert(garment.demandLines?.every((line) => line.patternFileId === '' && line.pieceRowId === ''), `${craftName} 成衣明细不得伪造纸样或裁片占位`)
  assert.deepEqual(garment.feiTicketNos, [], `${craftName} 成衣任务不得关联菲票`)
}

const packageMemberOrder = productionOrders.find((order) => order.demandSnapshot.spuCode === 'SPU-2024-010')
assert(packageMemberOrder, '缺少纸样包与物料关联重复回归用例')
const packageMemberSnapshot = getProductionOrderTechPackSnapshot(packageMemberOrder.productionOrderId)
assert(packageMemberSnapshot, 'SPU-2024-010 缺少冻结技术包快照')
const physicalPattern = packageMemberSnapshot.patternFiles.find((pattern) => pattern.recordKind === 'PACKAGE')
const materialAssociationPattern = packageMemberSnapshot.patternFiles.find(
  (pattern) => pattern.recordKind === 'MATERIAL_ASSOCIATION' && pattern.sourcePatternPackageId === physicalPattern?.patternFileId,
)
assert(physicalPattern && materialAssociationPattern, '回归用例必须同时包含纸样包和其物料关联记录')
assert(
  physicalPattern.pieceRows?.some((row) => materialAssociationPattern.pieceRows?.some((memberRow) => memberRow.id === row.id)),
  '纸样包与物料关联记录必须携带相同 pieceRowId 才能验证重复边界',
)
const packageMemberResult = generateSpecialCraftTaskOrdersFromProductionOrder({
  productionOrder: packageMemberOrder,
  techPackSnapshot: packageMemberSnapshot,
})
const expectedPlanQtyByCraft = new Map([
  ['烫画', 3500],
  ['直喷', 7000],
])
expectedPlanQtyByCraft.forEach((expectedPlanQty, craftName) => {
  const task = packageMemberResult.taskOrders.find(
    (item) => item.craftName === craftName && item.targetObject === '已裁部位',
  )
  assert(task, `${craftName} 缺少纸样包裁片任务`)
  const identities = (task.demandLines ?? []).map((line) => {
    const sku = packageMemberOrder.demandSnapshot.skuLines.find(
      (skuLine) => skuLine.color === line.colorName && skuLine.size === line.sizeCode,
    )
    assert(sku, `${craftName} 任务明细无法回溯生产 SKU`)
    return [line.pieceRowId, sku.skuCode, line.operationId, line.targetObject].join('::')
  })
  assert.equal(new Set(identities).size, identities.length, `${craftName} 同一任务不得重复计入同一裁片与 SKU`)
  const expectedPlanQtyFromSnapshot = (physicalPattern.pieceRows ?? [])
    .filter((row) => (row.specialCrafts ?? []).some((craft) => craft.craftName === craftName))
    .reduce((rowTotal, row) => rowTotal + (row.colorAllocations ?? []).reduce((allocationTotal, allocation) => {
      const applicableSkuLines = allocation.skuCodes?.length
        ? allocation.skuCodes.flatMap((skuCode) => {
            const skuLine = packageMemberOrder.demandSnapshot.skuLines.find((line) => line.skuCode === skuCode)
            return skuLine ? [skuLine] : []
          })
        : packageMemberOrder.demandSnapshot.skuLines.filter((line) => line.color === allocation.colorName)
      return allocationTotal + applicableSkuLines.reduce(
        (skuTotal, skuLine) => skuTotal + skuLine.qty * allocation.pieceCount,
        0,
      )
    }, 0), 0)
  assert.equal(expectedPlanQtyFromSnapshot, expectedPlanQty, `${craftName} 回归用例的 SKU 数量乘每件片数基线有误`)
  assert.equal(
    (task.demandLines ?? []).reduce((sum, line) => sum + line.planPieceQty, 0),
    expectedPlanQtyFromSnapshot,
    `${craftName} 计划数量必须等于生产 SKU 数量乘每件片数且不重复`,
  )
  assert.equal(task.planQty, expectedPlanQtyFromSnapshot, `${craftName} 加工单汇总数量不得被纸样关联层翻倍`)
})

const mixedPatternSnapshot = JSON.parse(JSON.stringify(packageMemberSnapshot)) as typeof packageMemberSnapshot
const orphanAssociation = JSON.parse(JSON.stringify(materialAssociationPattern)) as typeof materialAssociationPattern
const orphanPieceRow = orphanAssociation.pieceRows?.find(
  (row) => (row.specialCrafts ?? []).some((craft) => craft.craftName === '烫画'),
)
assert(orphanPieceRow, '混合快照回归用例缺少烫画裁片')
orphanAssociation.id = 'PATTERN-ASSOCIATION-WITHOUT-PACKAGE'
orphanAssociation.patternFileId = orphanAssociation.id
orphanAssociation.sourcePatternPackageId = 'PATTERN-PACKAGE-NOT-IN-SNAPSHOT'
orphanAssociation.patternFileName = '独有物料关联纸样'
orphanAssociation.pieceRows = [{
  ...orphanPieceRow,
  id: 'PIECE-ROW-ORPHAN-HEAT-TRANSFER',
}]
mixedPatternSnapshot.patternFiles.push(orphanAssociation)
const mixedPatternResult = buildSpecialCraftTaskDemandLinesFromProductionOrder({
  productionOrder: packageMemberOrder,
  techPackSnapshot: mixedPatternSnapshot,
})
assert(
  mixedPatternResult.demandLines.some((line) => line.pieceRowId === 'PIECE-ROW-ORPHAN-HEAT-TRANSFER'),
  '有物理纸样时不得删除无对应纸样包的合法独有关联工艺',
)

const multiPhysicalPatternSnapshot = JSON.parse(JSON.stringify(packageMemberSnapshot)) as typeof packageMemberSnapshot
const secondPhysicalPattern = JSON.parse(JSON.stringify(physicalPattern)) as typeof physicalPattern
secondPhysicalPattern.id = 'PATTERN-PACKAGE-SECOND-PHYSICAL'
secondPhysicalPattern.patternFileId = secondPhysicalPattern.id
secondPhysicalPattern.patternFileName = '第二个独立物理纸样包'
multiPhysicalPatternSnapshot.patternFiles.push(secondPhysicalPattern)
const multiPhysicalPatternResult = buildSpecialCraftTaskDemandLinesFromProductionOrder({
  productionOrder: packageMemberOrder,
  techPackSnapshot: multiPhysicalPatternSnapshot,
})
const multiPhysicalHeatLines = multiPhysicalPatternResult.demandLines.filter(
  (line) => line.craftName === '烫画' && line.targetObject === '已裁部位',
)
assert.equal(multiPhysicalHeatLines.length, 8, '两个独立物理纸样包应分别产生裁片明细')
assert.equal(
  new Set(multiPhysicalHeatLines.map((line) => line.demandLineId)).size,
  multiPhysicalHeatLines.length,
  '不同物理纸样包的相同裁片与 SKU 必须生成唯一明细 ID',
)

const missingGarmentBomSnapshot = JSON.parse(JSON.stringify(dualTargetSnapshot)) as typeof dualTargetSnapshot
missingGarmentBomSnapshot.bomItems = missingGarmentBomSnapshot.bomItems.filter((item) => item.id !== garmentBomId)
const missingGarmentBomResult = generateSpecialCraftTaskOrdersFromProductionOrder({
  productionOrder: dualTargetOrder,
  techPackSnapshot: missingGarmentBomSnapshot,
})
assert(
  missingGarmentBomResult.errors.some((error) => error.errorType === '成衣BOM缺失' && error.blocking),
  '成衣辅助工艺缺少关联成衣 BOM 时必须阻断生成',
)

const emptyApplicableSkuSnapshot = JSON.parse(JSON.stringify(dualTargetSnapshot)) as typeof dualTargetSnapshot
const emptyApplicableSkuBom = emptyApplicableSkuSnapshot.bomItems.find((item) => item.id === garmentBomId)
assert(emptyApplicableSkuBom, '成衣 BOM 空适用 SKU 回归用例缺少 BOM')
emptyApplicableSkuBom.applicableSkuCodes = []
const emptyApplicableSkuResult = buildSpecialCraftTaskDemandLinesFromProductionOrder({
  productionOrder: dualTargetOrder,
  techPackSnapshot: emptyApplicableSkuSnapshot,
})
assert(
  emptyApplicableSkuResult.errors.some((error) => error.errorType === '成衣BOM适用SKU缺失' && error.blocking),
  '成衣 BOM 适用 SKU 为空时必须按统一错误模型阻断',
)

const unmatchedApplicableSkuSnapshot = JSON.parse(JSON.stringify(dualTargetSnapshot)) as typeof dualTargetSnapshot
const unmatchedApplicableSkuBom = unmatchedApplicableSkuSnapshot.bomItems.find((item) => item.id === garmentBomId)
assert(unmatchedApplicableSkuBom, '成衣 BOM 无生产数量匹配回归用例缺少 BOM')
unmatchedApplicableSkuBom.applicableSkuCodes = ['SKU-NOT-IN-PRODUCTION-ORDER']
const unmatchedApplicableSkuResult = buildSpecialCraftTaskDemandLinesFromProductionOrder({
  productionOrder: dualTargetOrder,
  techPackSnapshot: unmatchedApplicableSkuSnapshot,
})
assert(
  unmatchedApplicableSkuResult.errors.some((error) => error.errorType === '成衣BOM适用SKU无生产数量' && error.blocking),
  '成衣 BOM 适用 SKU 全部无生产数量匹配时必须阻断',
)

const duplicateSkuOrder = JSON.parse(JSON.stringify(dualTargetOrder)) as typeof dualTargetOrder
const duplicateSkuLine = duplicateSkuOrder.demandSnapshot.skuLines.find((line) => line.skuCode === applicableSku.skuCode)
assert(duplicateSkuLine, '重复 SKU 回归用例缺少生产 SKU')
duplicateSkuOrder.demandSnapshot.skuLines.push({ ...duplicateSkuLine })
const duplicateSkuResult = buildSpecialCraftTaskDemandLinesFromProductionOrder({
  productionOrder: duplicateSkuOrder,
  techPackSnapshot: dualTargetSnapshot,
})
assert(
  duplicateSkuResult.errors.some((error) => error.errorType === '生产SKU重复' && error.blocking),
  '生产单同一 SKU 重复时必须阻断，不得重复累计数量',
)
const duplicateSkuGarmentLines = duplicateSkuResult.demandLines.filter(
  (line) => line.targetObject === '成衣' && line.colorName === duplicateSkuLine.color && line.sizeCode === duplicateSkuLine.size,
)
assert.equal(
  new Set(duplicateSkuGarmentLines.map((line) => line.demandLineId)).size,
  duplicateSkuGarmentLines.length,
  '重复 SKU 不得产生重复成衣明细 ID',
)

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
for (const craftName of ['直喷', '烫画'] as const) {
  const craftOrders = allStoreTasks.filter((order) => order.craftName === craftName)
  const cutPiece = craftOrders.find((order) => order.targetObject === '已裁部位')
  const garment = craftOrders.find((order) => order.targetObject === '成衣')
  assert(cutPiece, `${craftName} 必须生成裁片部位加工单`)
  assert(garment, `${craftName} 必须生成成衣加工单`)
  assert.equal(cutPiece.unit, '片', `${craftName} 裁片部位加工单单位必须为片`)
  assert.equal(garment.unit, '件', `${craftName} 成衣加工单单位必须为件`)
  assert.deepEqual(garment.feiTicketNos, [], `${craftName} 成衣加工单不得关联菲票`)
}
const feiTicketBindingResult = buildSpecialCraftFeiTicketBindingsFromGeneratedFeiTickets({
  specialCraftTaskOrders: allStoreTasks,
})
for (const craftName of ['直喷', '烫画'] as const) {
  const cutPieceTaskIds = new Set(
    allStoreTasks
      .filter((task) => task.craftName === craftName && task.targetObject === '已裁部位')
      .map((task) => task.taskOrderId),
  )
  const garmentTaskIds = new Set(
    allStoreTasks
      .filter((task) => task.craftName === craftName && task.targetObject === '成衣')
      .map((task) => task.taskOrderId),
  )
  const cutPieceBindings = feiTicketBindingResult.bindings.filter((binding) => cutPieceTaskIds.has(binding.taskOrderId))
  const garmentBindings = feiTicketBindingResult.bindings.filter((binding) => garmentTaskIds.has(binding.taskOrderId))
  assert(cutPieceBindings.length > 0, `${craftName} 裁片部位任务必须绑定真实菲票`)
  assert(cutPieceBindings.every((binding) => Boolean(binding.feiTicketId && binding.feiTicketNo && binding.cuttingOrderId)), `${craftName} 裁片部位任务菲票必须可回溯裁片单`)
  assert.equal(garmentBindings.length, 0, `${craftName} 成衣任务不得进入菲票绑定`)
}
allStoreTasks
  .filter((task) => (task.craftName === '直喷' || task.craftName === '烫画') && task.targetObject === '成衣')
  .forEach((task) => {
    const taskSnapshot = getProductionOrderTechPackSnapshot(task.productionOrderId)
    const taskOrder = productionOrders.find((order) => order.productionOrderId === task.productionOrderId)
    assert(taskSnapshot && taskOrder, `${task.taskOrderNo} 必须关联生产单冻结技术包`)
    task.demandLines?.forEach((line) => {
      assert(line.sourceBomItemId, `${task.taskOrderNo} 成衣明细必须保存来源 BOM`)
      const garmentBom = taskSnapshot.bomItems.find((item) => item.id === line.sourceBomItemId && item.type === '成衣')
      assert(garmentBom, `${task.taskOrderNo} 来源 BOM 必须是冻结快照中的成衣 BOM`)
      const skuLine = taskOrder.demandSnapshot.skuLines.find(
        (sku) => sku.color === line.colorName && sku.size === line.sizeCode,
      )
      assert(skuLine && garmentBom.applicableSkuCodes?.includes(skuLine.skuCode), `${task.taskOrderNo} 只能生成成衣 BOM 适用 SKU`)
    })
  })
assert.equal(new Set(allStoreTasks.map((task) => task.taskOrderId)).size, allStoreTasks.length, '特殊工艺加工单 taskOrderId 必须唯一')
assert.equal(new Set(allStoreTasks.map((task) => task.taskOrderNo)).size, allStoreTasks.length, '特殊工艺加工单 taskOrderNo 必须唯一')
assert.equal(new Set(allStoreTasks.map((task) => task.generationKey)).size, allStoreTasks.length, '特殊工艺加工单 generationKey 必须唯一')
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
const generatedTaskArtifacts = listGeneratedProductionTaskArtifacts()

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
const printPrepOrders = listPrepProcessOrders('PRINT')
const dyePrepOrders = listPrepProcessOrders('DYE')

const expectedPrintCount = activeCraftDefinitions.filter((definition) => definition.processCode === 'PRINT').length * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION
const expectedDyeCount = activeCraftDefinitions.filter((definition) => definition.processCode === 'DYE').length * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION
assert(printWorkOrders.length >= expectedPrintCount, '印花加工单 mock 数据必须覆盖印花字典工艺，每个至少 3 条')
assert(dyeWorkOrders.length >= expectedDyeCount, '染色加工单 mock 数据必须覆盖染色字典工艺，每个至少 3 条')
assert(printProcessWorkOrders.length >= expectedPrintCount, '统一印花加工单 mock 数据必须覆盖印花字典工艺，每个至少 3 条')
assert(dyeProcessWorkOrders.length >= expectedDyeCount, '统一染色加工单 mock 数据必须覆盖染色字典工艺，每个至少 3 条')
assert(printPrepOrders.length >= expectedPrintCount, 'Web 印花加工单 mock 数据必须覆盖印花字典工艺，每个至少 3 条')
assert(dyePrepOrders.length >= expectedDyeCount, 'Web 染色加工单 mock 数据必须覆盖染色字典工艺，每个至少 3 条')

printWorkOrders.forEach((order) => {
  if (order.sourceType === 'PRODUCTION_ORDER') {
    assertExistingProductionOrderWithSnapshot(order.sourceProductionOrderId!, '印花加工单必须来源于已有生产单')
    assert(Boolean(order.sourceProductionOrderNo && order.productionOrderOrderedAt), '印花加工单必须保留生产单号与下单时间')
    assert(!order.stockMaterialId, '生产单来源印花加工单不得携带备货来源')
  } else {
    assert(Boolean(order.stockMaterialId && order.stockMaterialName), '无真实生产单的印花 mock 必须迁为可追溯备货来源')
    assert(!order.sourceProductionOrderId && !order.sourceProductionOrderNo, '备货来源印花加工单不得伪造生产单')
  }
  assert(order.printOrderNo.trim().length > 0, '印花加工单必须保留稳定单号')
})
dyeWorkOrders.forEach((order) => {
  if (order.sourceType === 'PRODUCTION_ORDER') {
    const sourceOrderExists = productionOrderIds.has(order.sourceProductionOrderId!)
    if (sourceOrderExists) {
      assertExistingProductionOrderWithSnapshot(order.sourceProductionOrderId!, '染色加工单必须来源于已有生产单')
    } else {
      assert(
        order.formalProductionOrderSnapshot?.productionOrderId === order.sourceProductionOrderId,
        '演示生产单来源的染色加工单必须保留正式生产快照',
      )
    }
    assert(Boolean(order.sourceProductionOrderNo && order.productionOrderOrderedAt), '染色加工单必须保留生产单号与下单时间')
    assert(!order.stockMaterialId, '生产单来源染色加工单不得携带备货来源')
  } else {
    assert(Boolean(order.stockMaterialId && order.stockMaterialName), '无真实生产单的染色加工单必须迁为可追溯备货来源')
    assert(!order.sourceProductionOrderId && !order.sourceProductionOrderNo, '备货来源染色加工单不得伪造生产单')
  }
  assert(order.dyeOrderNo.trim().length > 0, '染色加工单必须保留稳定单号')
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
