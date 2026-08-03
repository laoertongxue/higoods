import assert from 'node:assert/strict'

import {
  buildDependencyClosure,
  listEngineeringTaskDefinitions,
  listPreparationProjectionItems,
  resolveInitialTaskStatus,
} from '../src/data/pcs-engineering-dependency-policy.ts'

// 10 类专业任务定义
const definitions = listEngineeringTaskDefinitions()
assert.equal(definitions.length, 10, '必须包含 10 类专业任务定义')

// 固定依赖：产前版样衣等待全部基码
assert.deepEqual(
  definitions.find((item) => item.taskType === 'PRE_PRODUCTION_SAMPLE')?.dependsOn,
  ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT'],
)

// 固定依赖：齐码纸样在产前版样衣完成后并行
assert.deepEqual(
  definitions.find((item) => item.taskType === 'SIZE_PATTERN_WOVEN')?.dependsOn,
  ['PRE_PRODUCTION_SAMPLE'],
)
assert.deepEqual(
  definitions.find((item) => item.taskType === 'SIZE_PATTERN_KNIT')?.dependsOn,
  ['PRE_PRODUCTION_SAMPLE'],
)

// 固定依赖：基码可并行、辅料下单与纸样链并行
assert.deepEqual(definitions.find((item) => item.taskType === 'BASE_PATTERN_WOVEN')?.dependsOn, [])
assert.deepEqual(definitions.find((item) => item.taskType === 'BASE_PATTERN_KNIT')?.dependsOn, [])
assert.deepEqual(definitions.find((item) => item.taskType === 'ACCESSORY_PURCHASE')?.dependsOn, [])

// 技术包确认依赖其余全部专业任务
const techPackConfirmation = definitions.find((item) => item.taskType === 'TECH_PACK_CONFIRMATION')
assert.equal(techPackConfirmation?.dependsOn.length, 9, '技术包确认依赖其余 9 类专业任务')

// 调色任务包含四个阶段，顺序固定
assert.deepEqual(
  definitions.find((item) => item.taskType === 'COLOR_YARN')?.stages.map((item) => item.stageType),
  ['BOM_REQUIREMENT', 'COLOR_REQUIREMENT_CONFIRMATION', 'FACTORY_COLORING', 'BUYER_REVIEW'],
)
assert.deepEqual(
  definitions.find((item) => item.taskType === 'COLOR_FABRIC')?.stages.map((item) => item.stageType),
  ['BOM_REQUIREMENT', 'COLOR_REQUIREMENT_CONFIRMATION', 'FACTORY_COLORING', 'BUYER_REVIEW'],
)

// 花型、调色为条件任务；制版、样衣、辅料、技术包确认为常驻任务
assert.equal(definitions.find((item) => item.taskType === 'PATTERN_ARTWORK')?.conditionType, 'PRINT')
assert.equal(definitions.find((item) => item.taskType === 'COLOR_YARN')?.conditionType, 'DYE_YARN')
assert.equal(definitions.find((item) => item.taskType === 'COLOR_FABRIC')?.conditionType, 'DYE_FABRIC')
assert.equal(definitions.find((item) => item.taskType === 'BASE_PATTERN_WOVEN')?.conditionType, 'ALWAYS')

// 只有花型与调色需要审核
assert.equal(definitions.find((item) => item.taskType === 'PATTERN_ARTWORK')?.reviewRequired, true)
assert.equal(definitions.find((item) => item.taskType === 'COLOR_YARN')?.reviewRequired, true)
assert.equal(definitions.find((item) => item.taskType === 'BASE_PATTERN_WOVEN')?.reviewRequired, false)
assert.equal(definitions.find((item) => item.taskType === 'PRE_PRODUCTION_SAMPLE')?.reviewRequired, false)

// 11 个生产准备项投影节点，全部由工程主单任务覆盖
const projectionItems = listPreparationProjectionItems()
assert.equal(projectionItems.length, 11, '必须覆盖生产准备时效全部 11 个准备项')
assert.ok(projectionItems.some((item) => item.itemType === '梭织基码纸样' && item.taskType === 'BASE_PATTERN_WOVEN'))
assert.ok(projectionItems.some((item) => item.itemType === '毛织基码纸样' && item.taskType === 'BASE_PATTERN_KNIT'))
assert.ok(projectionItems.some((item) => item.itemType === '版衣制作' && item.taskType === 'PRE_PRODUCTION_SAMPLE'))
assert.ok(projectionItems.some((item) => item.itemType === '梭织齐码纸样' && item.taskType === 'SIZE_PATTERN_WOVEN'))
assert.ok(projectionItems.some((item) => item.itemType === '毛织齐码纸样' && item.taskType === 'SIZE_PATTERN_KNIT'))
assert.ok(projectionItems.some((item) => item.itemType === '数码印/DTF/DTG花型' && item.taskType === 'PATTERN_ARTWORK'))
assert.ok(projectionItems.some((item) => item.itemType === '确认染色要求（纱线）' && item.taskType === 'COLOR_YARN'))
assert.ok(projectionItems.some((item) => item.itemType === '染色调色（纱线）' && item.taskType === 'COLOR_YARN'))
assert.ok(projectionItems.some((item) => item.itemType === '确认染色要求（面料）' && item.taskType === 'COLOR_FABRIC'))
assert.ok(projectionItems.some((item) => item.itemType === '染色调色（面料）' && item.taskType === 'COLOR_FABRIC'))
assert.ok(projectionItems.some((item) => item.itemType === '辅料下单' && item.taskType === 'ACCESSORY_PURCHASE'))

// 自动补齐：选择后续任务时补齐缺失前置
const closure = buildDependencyClosure(['SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'])
for (const code of ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'PRE_PRODUCTION_SAMPLE']) {
  assert.ok(closure.includes(code), `自动补齐应包含前置 ${code}`)
}

// 初始状态派生：无前置待开始、有前置待前置、条件任务未启用
assert.equal(resolveInitialTaskStatus('BASE_PATTERN_WOVEN'), '待开始')
assert.equal(resolveInitialTaskStatus('ACCESSORY_PURCHASE'), '待开始')
assert.equal(resolveInitialTaskStatus('PRE_PRODUCTION_SAMPLE'), '待前置')
assert.equal(resolveInitialTaskStatus('TECH_PACK_CONFIRMATION'), '待前置')
assert.equal(resolveInitialTaskStatus('PATTERN_ARTWORK'), '未启用')
assert.equal(resolveInitialTaskStatus('COLOR_YARN'), '未启用')
assert.equal(resolveInitialTaskStatus('COLOR_FABRIC'), '未启用')

console.log('pcs-engineering-dependency-policy.spec.ts PASS')
