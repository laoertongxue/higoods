import assert from 'node:assert/strict'

import {
  getProcessCraftByLegacyValue,
  getProcessDefinitionByCode,
  getProcessCraftDictRowByCode,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  getFactorySupplyFormulaGuide,
  getFactorySupplyFormulaTemplate,
} from '../src/data/fcs/process-craft-output-value-explainer.ts'
import type {
  TechnicalBomItem,
  TechnicalProcessEntry,
} from '../src/data/pcs-technical-data-version-types.ts'

const printProcess = getProcessDefinitionByCode('PRINT')
const waterProcess = getProcessDefinitionByCode('WATER_SOLUBLE')
const dyeProcess = getProcessDefinitionByCode('DYE')
const waterCraft = getProcessCraftByLegacyValue(2000009)

assert(printProcess, '工序字典缺少 PRINT 印花定义')
assert(waterProcess, '工序字典缺少 WATER_SOLUBLE 水溶定义')
assert(dyeProcess, '工序字典缺少 DYE 染色定义')
assert.equal(waterProcess.stageCode, 'PREP', '水溶必须属于准备阶段')
assert.equal(waterProcess.sort, 15, '水溶排序必须固定为 15')
assert(printProcess.sort < waterProcess.sort, '水溶排序必须晚于印花')
assert(waterProcess.sort < dyeProcess.sort, '水溶排序必须早于染色')
assert.equal(waterProcess.processRole, 'EXTERNAL_TASK', '水溶必须是对外任务')
assert.equal(waterProcess.generatesExternalTask, true, '水溶必须生成对外任务')
assert.equal(waterProcess.requiresTaskQr, true, '水溶必须生成任务二维码')
assert.equal(waterProcess.requiresHandoverOrder, true, '水溶必须生成交接单')
assert.equal(waterProcess.capacityEnabled, true, '水溶必须启用产能配置')
assert.equal(waterProcess.capacityRollupMode, 'SELF', '水溶产能必须按自身汇总')
assert.equal(waterProcess.defaultDocType, 'TASK', '水溶必须默认生成任务单')
assert.equal(waterProcess.factoryMobileExecutionMode, 'FULL_TASK', '水溶必须支持工厂移动端完整任务执行')
assert.equal(waterProcess.isActive, true, '水溶工序必须启用')
assert.equal(waterProcess.description, '由 BOM 物料上的水溶要求触发', '水溶工序说明错误')
assert.equal(waterProcess.triggerSource, 'BOM 物料存在水溶要求', '水溶触发来源错误')
assert.equal(waterProcess.systemProcessCode, 'PROC_WATER_SOLUBLE', '水溶系统工序编码错误')
assert.equal(waterProcess.assignmentGranularity, 'ORDER', '水溶必须按生产单分配')
assert.equal(waterProcess.detailSplitMode, 'COMPOSITE', '水溶必须使用组合维度拆分')
assert.deepEqual(waterProcess.detailSplitDimensions, ['MATERIAL_SKU'], '水溶必须按物料 SKU 拆分明细')

assert(waterCraft, '工序工艺字典缺少 legacyValue 2000009 水溶定义')
assert.equal(waterCraft.processCode, 'WATER_SOLUBLE', '水溶工艺必须归属 WATER_SOLUBLE')
assert.equal(waterCraft.craftName, '水溶', '水溶工艺名称错误')
assert.equal(waterCraft.defaultDocType, 'TASK', '水溶工艺必须默认生成任务单')
assert.equal(waterCraft.isActive, true, '水溶工艺必须启用')
assert.equal(waterCraft.isSpecialCraft, false, '水溶不得归入特殊工艺')
assert.equal(waterCraft.systemProcessCode, 'PROC_WATER_SOLUBLE', '水溶工艺系统编码错误')
assert.equal(waterCraft.carrySuggestion, '染色厂优先', '水溶必须由染色厂优先承接')
assert.equal(waterCraft.targetObject, 'BOM_MATERIAL', '水溶目标对象必须为 BOM 物料')
assert.equal(waterCraft.targetObjectName, 'BOM物料', '水溶目标对象名称错误')
assert.equal(waterCraft.referenceOutputValueValue, 70, '水溶理论参考产值必须为 70')
assert.equal(waterCraft.referenceOutputValueUnit, 'VALUE_PER_BATCH', '水溶理论参考产值必须按批')

const waterCraftRow = getProcessCraftDictRowByCode(waterCraft.craftCode)
assert.equal(waterCraftRow?.referenceOutputValueUnitLabel, '产值/批', '水溶理论参考产值单位中文标签错误')

assert.equal(getFactorySupplyFormulaTemplate('水溶'), 'D', '水溶必须复用批次型模板 D')
const waterGuide = getFactorySupplyFormulaGuide('水溶')
assert.equal(waterGuide.template, 'D', '水溶公共产值指南必须返回模板 D')
assert(waterGuide.currentFieldKeys.includes('batchLoadCapacity'), '水溶批次型模板必须包含单次有效装载量')
assert(waterGuide.currentFieldKeys.includes('cycleMinutes'), '水溶批次型模板必须包含单次循环分钟')

const technicalBomContract: TechnicalBomItem = {
  id: 'BOM-WATER-SOLUBLE-CHECK',
  type: '辅料',
  name: '水溶花边',
  spec: '常规',
  materialCode: 'MAT-WATER-001',
  unit: '米',
  unitConsumption: 1,
  lossRate: 0,
  supplier: '示例供应商',
  waterSolubleRequirement: '是',
}
const technicalProcessContract: Pick<
  TechnicalProcessEntry,
  'triggerField' | 'targetObject' | 'targetObjectName'
> = {
  triggerField: 'waterSolubleRequirement',
  targetObject: 'BOM_MATERIAL',
  targetObjectName: 'BOM物料',
}

assert.equal(technicalBomContract.materialCode, 'MAT-WATER-001', '技术包 BOM 物料编码契约错误')
assert.equal(technicalBomContract.unit, '米', '技术包 BOM 单位契约错误')
assert.equal(technicalBomContract.waterSolubleRequirement, '是', '技术包 BOM 水溶要求契约错误')
assert.equal(technicalProcessContract.triggerField, 'waterSolubleRequirement', '技术包工序触发字段契约错误')
assert.equal(technicalProcessContract.targetObject, 'BOM_MATERIAL', '技术包工序目标对象契约错误')
assert.equal(technicalProcessContract.targetObjectName, 'BOM物料', '技术包工序目标对象名称契约错误')

console.log('water-soluble process checks passed')
