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

const shrinking = getProcessDefinitionByCode('SHRINKING')
assert(shrinking, '缺少缩水工序定义')
assert(shrinking.stageCode === 'PREP', '缩水必须归准备阶段')
assert.equal(shrinking.processRole, 'PREPARATION_ORDER', '缩水只能产出生产准备单')
assert.equal(shrinking.generatesExternalTask, false, '缩水不得进入任务清单与任务分配')
assert.equal(shrinking.defaultDocType, 'PREPARATION_ORDER', '缩水默认单据必须是生产准备单')
const washing = getProcessDefinitionByCode('WASHING')
assert(washing, '缺少洗水工序定义')
assert(washing.stageCode === 'PREP', '洗水必须归准备阶段')
assert.equal(washing.processRole, 'PREPARATION_ORDER', '洗水只能产出生产准备单')
assert.equal(washing.generatesExternalTask, false, '洗水不得进入任务清单与任务分配')
assert.equal(washing.defaultDocType, 'PREPARATION_ORDER', '洗水默认单据必须是生产准备单')

const specialCraft = getProcessDefinitionByCode('SPECIAL_CRAFT')
assert(specialCraft, '缺少特殊工艺工序定义')
assert(specialCraft.processRole === 'EXTERNAL_TASK', '特殊工艺必须按对外任务维护')
assert(specialCraft.generatesExternalTask, '特殊工艺必须产出任务')

const washCraft = inactiveCrafts.find((item) => item.craftName === '洗水')
assert(washCraft, '历史停用工艺中缺少洗水兼容映射')
assert(washCraft.processCode === 'WASHING', '洗水历史映射必须挂在准备阶段洗水工序下')
assert.equal(washCraft.processRole, 'PREPARATION_ORDER', '洗水历史映射只能指向生产准备单')
assert.equal(washCraft.generatesExternalTask, false, '洗水历史映射不得产出对外任务')
assert.equal(washCraft.requiresTaskQr, false, '洗水未形成完整闭环前不得生成 PDA 二维码')
assert.equal(washCraft.requiresHandoverOrder, false, '洗水未形成完整闭环前不得生成交出单')
assert.equal(washCraft.factoryMobileExecutionMode, 'NONE', '洗水未形成完整闭环前不得进入 PDA 执行')
assert.equal(washCraft.capacityEnabled, false, '洗水未形成完整闭环前不得进入产能计算')
assert.equal(washCraft.defaultDocType, 'PREPARATION_ORDER', '洗水历史映射默认单据必须是生产准备单')
assert(!activeCrafts.some((item) => item.processCode === 'SHRINKING'), '缩水未形成完整闭环前不得出现在活跃工艺')
assert(!activeCrafts.some((item) => item.processCode === 'WASHING'), '洗水未形成完整闭环前不得出现在活跃工艺')
assert(!activeOptions.some((item) => ['SHRINKING', 'WASHING'].includes(item.processCode)), '缩水、洗水不得出现在可选工序工艺')
assert(!capacityOptions.some((item) => ['SHRINKING', 'WASHING'].includes(item.processCode)), '缩水、洗水不得进入产能工序工艺选项')
assert(!activeCrafts.some((item) => item.processCode === 'SPECIAL_CRAFT' && item.craftName === '洗水'), '洗水不得挂在特殊工艺下')
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
assert.equal(getProcessDefinitionByCode('IRONING'), undefined, '历史熨烫工序不得作为活跃工序')
assert.equal(getProcessDefinitionByCode('PACKAGING'), undefined, '历史包装工序不得作为活跃工序')

for (const processCode of ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK']) {
  const node = getProcessDefinitionByCode(processCode)
  assert(node, `缺少后道阶段实际工序 ${processCode}`)
  assert(node.stageCode === 'POST', `${processCode} 必须归属后道阶段`)
  assert(isPostCapacityNode(processCode), `${processCode} 必须被识别为后道阶段产能工序`)
}
assert.equal(getProcessDefinitionByCode('BUTTONHOLE')?.generatesExternalTask, false, '开扣眼不得伪造成通用后道任务')
assert.equal(getProcessDefinitionByCode('BUTTON_ATTACH')?.generatesExternalTask, false, '装扣子不得伪造成通用后道任务')
assert.equal(getProcessDefinitionByCode('IRON_PACK')?.processName, '烫包', '当前熨烫/包装口径必须合并为烫包')
const activeIronPackCrafts = activeCrafts.filter((item) => item.processCode === 'IRON_PACK')
assert.deepEqual(activeIronPackCrafts.map((item) => item.craftName), ['烫包'], '烫包当前工艺选项必须唯一，不得继续暴露熨烫或包装')
assert(inactiveCrafts.filter((item) => item.processCode === 'IRON_PACK' && ['熨烫', '包装'].includes(item.legacyCraftName)).every((item) => item.craftName === '烫包'), '历史熨烫/包装必须只作为烫包归一映射')

const craftDictPage = read('src/pages/production-craft-dict.ts')
const craftDictSource = read('src/data/fcs/process-craft-dict.ts')
const taskBreakdownPage = read('src/pages/task-breakdown.ts')
const factoryMockSource = read('src/data/fcs/factory-mock-data.ts')
const onboardingStoreSource = read('src/data/fcs/factory-onboarding-store.ts')
const onboardingFlowSource = read('src/data/fcs/factory-onboarding-flow.ts')

assert(!craftDictPage.includes('>WASHING<'), '工序工艺字典页面不应直显 WASHING')
assert(!craftDictPage.includes('基础工序顺序'), '工序工艺字典页面不得保留跨款式默认顺序')
assert(processDefinitions.every((item) => !('sort' in item)), '工序定义不得携带跨款式默认顺序')
assert(!craftDictSource.includes('getDefaultProcessRouteOrder'), '工序字典不得保留默认路线顺序查询')
assertNoRemovedLegacyTerm(craftDictPage, assert, '工序工艺字典页面不应保留已删除旧项')
assertNoRemovedLegacyTerm(craftDictSource, assert, '工序工艺字典源码不应保留已删除旧项')
assert(taskBreakdownPage.includes('合并任务仅支持车缝+烫包、裁剪+车缝+烫包'), '任务清单缺少两种固定合并范围口径')
assert(taskBreakdownPage.includes('生产准备工序不进入任务清单'), '任务清单必须明确隔离生产准备工序')
assert(factoryMockSource.includes("CENTRAL_DENIM_WASH: ['WASHING', 'SHRINKING']"), '牛仔洗水厂能力必须按准备阶段洗水 / 缩水维护')
assert(!factoryMockSource.includes('特殊工艺 - 洗水'), '工厂能力数据不得保留特殊工艺 - 洗水')
assert(factoryMockSource.includes("['BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK']"), '工厂能力源必须只保留后道阶段三个实际工序')
assert(!factoryMockSource.includes("'IRONING'"), '工厂能力数据不得继续暴露历史熨烫工序')
assert(!factoryMockSource.includes("'PACKAGING'"), '工厂能力数据不得继续暴露历史包装工序')
assert(!onboardingStoreSource.includes("createCapability('后道', '包装'"), '工厂入驻 Mock 不得继续生成后道/包装旧能力')
assert(!onboardingFlowSource.includes("['质检', '复检', '包装', '熨烫']"), '工厂类型识别不得把质检复检或历史名称当作工序能力')

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
