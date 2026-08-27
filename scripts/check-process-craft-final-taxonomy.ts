#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  getProcessDefinitionByCode,
  getActiveProcessCraftOptions,
  getCapacityProcessCraftOptions,
  isPostCapacityNode,
  listActiveProcessCraftDefinitions,
  listInactiveProcessCraftDefinitions,
  listProcessCraftDictRows,
  listProcessDefinitions,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  assertNoRemovedLegacyTerm,
  getRemovedPseudoCraftPattern,
  removedLegacyCraftNames,
  removedLegacyProcessCodes,
} from './utils/special-craft-banlist.ts'

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

const processDefinitions = listProcessDefinitions()
const activeCrafts = listActiveProcessCraftDefinitions()
const inactiveCrafts = listInactiveProcessCraftDefinitions()
const activeOptions = getActiveProcessCraftOptions()
const capacityOptions = getCapacityProcessCraftOptions()
const craftDictRows = listProcessCraftDictRows(true)
const removedCraftNameSet = new Set(removedLegacyCraftNames)
const removedPseudoCraftPattern = getRemovedPseudoCraftPattern()

removedLegacyProcessCodes.forEach((processCode) => {
  assert(!processDefinitions.some((item) => item.processCode === processCode), '活跃工序中不应保留已删除旧编码')
})

const specialCraft = getProcessDefinitionByCode('SPECIAL_CRAFT')
assert(specialCraft, '缺少特殊工艺工序定义')
assert(specialCraft.processRole === 'EXTERNAL_TASK', '特殊工艺必须按对外任务维护')
assert(specialCraft.generatesExternalTask, '特殊工艺必须产出任务')

assert(!activeCrafts.some((item) => removedCraftNameSet.has(item.craftName)), '活跃工艺中不应保留已删除旧项')
assert(!inactiveCrafts.some((item) => removedCraftNameSet.has(item.craftName)), '历史工艺中不应保留已删除旧项')
assert(!craftDictRows.some((item) => removedCraftNameSet.has(item.craftName)), '工序工艺字典中不应保留已删除旧项')
assert(
  !activeOptions.some((item) => removedPseudoCraftPattern.test(item.label) || removedPseudoCraftPattern.test(item.craftName)),
  '活跃工序工艺选项中不应暴露伪特殊工艺',
)
assert(
  !capacityOptions.some((item) => removedPseudoCraftPattern.test(item.label) || removedPseudoCraftPattern.test(item.craftName)),
  '产能工序工艺选项中不应暴露伪特殊工艺',
)

assert.equal(getProcessDefinitionByCode('POST_FINISHING'), undefined, '后道只能作为阶段，不得存在名为后道的活跃工序')

for (const processCode of ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK']) {
  const node = getProcessDefinitionByCode(processCode)
  assert(node, `缺少后道阶段实际工序 ${processCode}`)
  assert(node.stageCode === 'POST', `${processCode} 必须归属后道阶段`)
  assert(isPostCapacityNode(processCode), `${processCode} 必须被识别为后道阶段产能工序`)
}
assert.equal(getProcessDefinitionByCode('BUTTONHOLE')?.generatesExternalTask, false, '开扣眼不得伪造成通用后道任务')
assert.equal(getProcessDefinitionByCode('BUTTON_ATTACH')?.generatesExternalTask, false, '装扣子不得伪造成通用后道任务')
assert.equal(getProcessDefinitionByCode('IRON_PACK')?.processName, '烫包', '后道成衣处理必须统一为烫包')
const activeIronPackCrafts = activeCrafts.filter((item) => item.processCode === 'IRON_PACK')
assert.deepEqual(activeIronPackCrafts.map((item) => item.craftName), ['烫包'], '烫包当前工艺选项必须唯一')
assert.equal(activeIronPackCrafts[0]?.targetObjectName, '成衣', '后道烫包的作用对象必须是成衣')
assert.equal(activeIronPackCrafts[0]?.assignmentGranularity, 'ORDER', '独立烫包必须按整个生产任务分配')
assert.deepEqual(activeIronPackCrafts[0]?.detailSplitDimensions, ['GARMENT_SKU'], '独立烫包必须保留可查看的成衣 SKU 需求明细')
assert.equal(inactiveCrafts.some((item) => item.processCode === 'IRON_PACK'), false, '烫包不得携带旧工艺兼容行')

const craftDictPage = read('src/pages/production-craft-dict.ts')
const craftDictSource = read('src/data/fcs/process-craft-dict.ts')
const taskBreakdownPage = read('src/pages/task-breakdown.ts')
const factoryMockSource = read('src/data/fcs/factory-mock-data.ts')
const onboardingStoreSource = read('src/data/fcs/factory-onboarding-store.ts')
const onboardingFlowSource = read('src/data/fcs/factory-onboarding-flow.ts')

assert(!craftDictPage.includes('基础工序顺序'), '工序工艺字典页面不得保留跨款式默认顺序')
assert(processDefinitions.every((item) => !('sort' in item)), '工序定义不得携带跨款式默认顺序')
assert(!craftDictSource.includes('getDefaultProcessRouteOrder'), '工序字典不得保留默认路线顺序查询')
assertNoRemovedLegacyTerm(craftDictPage, assert, '工序工艺字典页面不应保留已删除旧项')
assertNoRemovedLegacyTerm(craftDictSource, assert, '工序工艺字典源码不应保留已删除旧项')
assert(taskBreakdownPage.includes('合并任务仅支持车缝+烫包、裁剪+车缝+烫包'), '任务清单缺少两种固定合并范围口径')
assert(taskBreakdownPage.includes('生产准备工序不进入任务清单'), '任务清单必须明确隔离生产准备工序')
assert(factoryMockSource.includes("['BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK']"), '工厂能力源必须只保留后道阶段三个实际工序')
assert(onboardingStoreSource.includes("'IRON_PACK'"), '工厂入驻能力必须使用烫包业务码')
assert(onboardingFlowSource.includes("IRON_PACK"), '工厂类型识别必须支持烫包能力')

console.log(
  JSON.stringify(
    {
      工序数: processDefinitions.length,
      活跃工艺数: activeCrafts.length,
      历史停用工艺数: inactiveCrafts.length,
      最终分类: '通过',
    },
    null,
    2,
  ),
)
