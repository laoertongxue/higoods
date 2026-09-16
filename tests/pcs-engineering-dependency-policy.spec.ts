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

// 生产准备直接读取设计改款阶段已确认的基码纸样；首单样衣可立即开始。
assert.deepEqual(
  definitions.find((item) => item.taskType === 'PRE_PRODUCTION_SAMPLE')?.dependsOn,
  [],
)

// 首单样衣与齐码纸样可以并行，业务上仅推荐先完成首单样衣。
assert.deepEqual(
  definitions.find((item) => item.taskType === 'SIZE_PATTERN_WOVEN')?.dependsOn,
  [],
)
assert.deepEqual(
  definitions.find((item) => item.taskType === 'SIZE_PATTERN_KNIT')?.dependsOn,
  [],
)

// 固定依赖：基码可并行、辅料下单与纸样链并行
assert.deepEqual(definitions.find((item) => item.taskType === 'BASE_PATTERN_WOVEN')?.dependsOn, [])
assert.deepEqual(definitions.find((item) => item.taskType === 'BASE_PATTERN_KNIT')?.dependsOn, [])
assert.deepEqual(definitions.find((item) => item.taskType === 'ACCESSORY_PURCHASE')?.dependsOn, [])

// 技术包确认依赖其余全部专业任务
const techPackConfirmation = definitions.find((item) => item.taskType === 'TECH_PACK_CONFIRMATION')
assert.equal(techPackConfirmation?.dependsOn.length, 7, '技术包确认依赖生产准备阶段其余 7 类可启用任务')

// 调色任务包含四个阶段，顺序固定
assert.deepEqual(
  definitions.find((item) => item.taskType === 'COLOR_YARN')?.stages.map((item) => item.stageType),
  ['BOM_REQUIREMENT', 'COLOR_REQUIREMENT_CONFIRMATION', 'FACTORY_COLORING', 'BUYER_REVIEW'],
)
assert.deepEqual(
  definitions.find((item) => item.taskType === 'COLOR_FABRIC')?.stages.map((item) => item.stageType),
  ['BOM_REQUIREMENT', 'COLOR_REQUIREMENT_CONFIRMATION', 'FACTORY_COLORING', 'BUYER_REVIEW'],
)

// 花型、调色和辅料下单均由结构化 BOM 条件启用。
assert.equal(definitions.find((item) => item.taskType === 'PATTERN_ARTWORK')?.conditionType, 'PRINT')
assert.equal(definitions.find((item) => item.taskType === 'COLOR_YARN')?.conditionType, 'DYE_YARN')
assert.equal(definitions.find((item) => item.taskType === 'COLOR_FABRIC')?.conditionType, 'DYE_FABRIC')
assert.equal(definitions.find((item) => item.taskType === 'ACCESSORY_PURCHASE')?.conditionType, 'PURCHASE_ACCESSORY')
assert.equal(definitions.find((item) => item.taskType === 'BASE_PATTERN_WOVEN')?.conditionType, 'ALWAYS')

// 只有花型与调色需要审核
assert.equal(definitions.find((item) => item.taskType === 'PATTERN_ARTWORK')?.reviewRequired, true)
assert.equal(definitions.find((item) => item.taskType === 'COLOR_YARN')?.reviewRequired, true)
assert.equal(definitions.find((item) => item.taskType === 'BASE_PATTERN_WOVEN')?.reviewRequired, false)
assert.equal(definitions.find((item) => item.taskType === 'PRE_PRODUCTION_SAMPLE')?.reviewRequired, false)

// 基码纸样属于设计改款前期资料，生产准备时效只投影本阶段 9 个准备项。
const projectionItems = listPreparationProjectionItems()
assert.equal(projectionItems.length, 9, '必须覆盖生产准备时效全部 9 个本阶段准备项')
assert.equal(projectionItems.some((item) => item.taskType === 'BASE_PATTERN_WOVEN' || item.taskType === 'BASE_PATTERN_KNIT'), false)
assert.ok(projectionItems.some((item) => item.itemType === '版衣制作' && item.taskType === 'PRE_PRODUCTION_SAMPLE'))
assert.ok(projectionItems.some((item) => item.itemType === '梭织齐码纸样' && item.taskType === 'SIZE_PATTERN_WOVEN'))
assert.ok(projectionItems.some((item) => item.itemType === '毛织齐码纸样' && item.taskType === 'SIZE_PATTERN_KNIT'))
assert.ok(projectionItems.some((item) => item.itemType === '数码印/DTF/DTG花型' && item.taskType === 'PATTERN_ARTWORK'))
assert.ok(projectionItems.some((item) => item.itemType === '确认染色要求（纱线）' && item.taskType === 'COLOR_YARN'))
assert.ok(projectionItems.some((item) => item.itemType === '染色调色（纱线）' && item.taskType === 'COLOR_YARN'))
assert.ok(projectionItems.some((item) => item.itemType === '确认染色要求（面料）' && item.taskType === 'COLOR_FABRIC'))
assert.ok(projectionItems.some((item) => item.itemType === '染色调色（面料）' && item.taskType === 'COLOR_FABRIC'))
assert.ok(projectionItems.some((item) => item.itemType === '辅料下单' && item.taskType === 'ACCESSORY_PURCHASE'))

// 首单样衣和齐码纸样之间没有强制前置。
const closure = buildDependencyClosure(['SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'])
assert.deepEqual(closure, ['SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'])

// 初始状态派生：无前置待开始、有前置待前置、条件任务未启用
assert.equal(resolveInitialTaskStatus('BASE_PATTERN_WOVEN'), '待开始')
assert.equal(resolveInitialTaskStatus('ACCESSORY_PURCHASE'), '未启用')
assert.equal(resolveInitialTaskStatus('PRE_PRODUCTION_SAMPLE'), '待开始')
assert.equal(resolveInitialTaskStatus('TECH_PACK_CONFIRMATION'), '待前置')
assert.equal(resolveInitialTaskStatus('PATTERN_ARTWORK'), '未启用')
assert.equal(resolveInitialTaskStatus('COLOR_YARN'), '未启用')
assert.equal(resolveInitialTaskStatus('COLOR_FABRIC'), '未启用')

console.log('pcs-engineering-dependency-policy.spec.ts PASS')
