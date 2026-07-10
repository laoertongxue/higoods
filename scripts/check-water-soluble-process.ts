import assert from 'node:assert/strict'

import {
  getProcessDefinitionByCode,
  listActiveProcessCraftDefinitions,
} from '../src/data/fcs/process-craft-dict.ts'

const waterProcess = getProcessDefinitionByCode('WATER_SOLUBLE')
const dyeProcess = getProcessDefinitionByCode('DYE')

assert(waterProcess, '工序字典缺少 WATER_SOLUBLE 水溶定义')
assert(dyeProcess, '工序字典缺少 DYE 染色定义')
assert.equal(waterProcess.stageCode, 'PREP', '水溶必须属于准备阶段')
assert.equal(waterProcess.defaultDocType, 'TASK', '水溶必须默认生成任务单')
assert.equal(waterProcess.factoryMobileExecutionMode, 'FULL_TASK', '水溶必须支持工厂移动端完整任务执行')
assert(waterProcess.sort < dyeProcess.sort, '水溶排序必须早于染色')
assert(
  listActiveProcessCraftDefinitions().some(
    (item) => item.processCode === 'WATER_SOLUBLE' && item.craftName === '水溶',
  ),
  '启用工序工艺字典缺少 WATER_SOLUBLE / 水溶',
)

console.log('water-soluble process checks passed')
