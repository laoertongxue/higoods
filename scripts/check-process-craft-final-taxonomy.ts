#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  getProcessDefinitionByCode,
  getActiveProcessCraftOptions,
  getCapacityProcessCraftOptions,
  getProcessCraftByCode,
  getProcessCraftByLegacyValue,
  isPostCapacityNode,
  listActiveProcessCraftDefinitions,
  listInactiveProcessCraftDefinitions,
  listProcessCraftDictRows,
  listProcessDefinitions,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  COVERED_BUTTON_OPERATION_ID,
  getSpecialCraftOperationById,
  getSpecialCraftWorkOrderBusinessType,
  listEnabledSpecialCraftOperationDefinitions,
} from '../src/data/fcs/special-craft-operations.ts'
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
assert.equal(getProcessDefinitionByCode('BUTTONHOLE')?.generatesExternalTask, false, '开扣眼不得伪造成通用后道生产任务')
assert.equal(getProcessDefinitionByCode('BUTTON_ATTACH')?.generatesExternalTask, false, '装扣子不得伪造成通用后道生产任务')
assert.equal(getProcessDefinitionByCode('IRON_PACK')?.processName, '烫包', '后道成衣处理必须统一为烫包')
const activeIronPackCrafts = activeCrafts.filter((item) => item.processCode === 'IRON_PACK')
assert.deepEqual(activeIronPackCrafts.map((item) => item.craftName), ['烫包'], '烫包当前工艺选项必须唯一')
assert.equal(activeIronPackCrafts[0]?.targetObjectName, '成衣', '后道烫包的作用对象必须是成衣')
assert.equal(activeIronPackCrafts[0]?.assignmentGranularity, 'ORDER', '独立烫包必须按整个生产任务分配')
assert.deepEqual(activeIronPackCrafts[0]?.detailSplitDimensions, ['GARMENT_SKU'], '独立烫包必须保留可查看的成衣 SKU 需求明细')
assert.equal(inactiveCrafts.some((item) => item.processCode === 'IRON_PACK'), false, '烫包不得携带旧工艺兼容行')

const printProcess = getProcessDefinitionByCode('PRINT')
assert.deepEqual(printProcess?.inputObjectTypes, ['BOM_MATERIAL'], '印花必须投入来源 BOM 原物料')
assert.deepEqual(printProcess?.outputObjectTypes, ['BOM_MATERIAL'], '印花必须产出同类 BOM 原物料')
const cuttingProcess = getProcessDefinitionByCode('CUT_PANEL')
assert.equal(cuttingProcess?.processName, '裁剪', 'CUT_PANEL 用户工序名必须是裁剪')
assert.deepEqual(cuttingProcess?.inputObjectTypes, ['FABRIC'], '裁剪必须投入布料')
assert.deepEqual(cuttingProcess?.outputObjectTypes, ['CUT_PIECE_PART'], '裁剪必须产出裁片')
const buttonAttachProcess = getProcessDefinitionByCode('BUTTON_ATTACH')
assert.deepEqual(buttonAttachProcess?.inputObjectTypes, ['GARMENT_SEMI'], '装扣子主加工对象必须是成衣')
assert.deepEqual(buttonAttachProcess?.consumedObjectTypes, ['ACCESSORY'], '装扣子必须把扣子表达为消耗辅料')
const wholeGarmentWoolCraft = getProcessCraftByLegacyValue(2000007)
assert.equal(wholeGarmentWoolCraft?.targetObject, 'GARMENT_SEMI', '整件毛织必须以成衣为产出对象')
assert.deepEqual(wholeGarmentWoolCraft?.inputObjectTypes, ['YARN'], '整件毛织必须投入纱线')
assert.deepEqual(wholeGarmentWoolCraft?.outputObjectTypes, ['GARMENT_SEMI'], '整件毛织必须产出成衣')
const panelWoolCraft = getProcessCraftByLegacyValue(2000008)
assert.equal(panelWoolCraft?.targetObject, 'WOOL_PANEL', '部位毛织必须以毛织横机片为产出对象')
assert.deepEqual(panelWoolCraft?.inputObjectTypes, ['YARN'], '部位毛织必须投入纱线')
assert.deepEqual(panelWoolCraft?.outputObjectTypes, ['WOOL_PANEL'], '部位毛织必须产出毛织横机片')

for (const craftCode of ['CRAFT_008192', 'CRAFT_016384']) {
  const craft = getProcessCraftByCode(craftCode)
  assert(craft, `${craftCode} 必须存在`)
  assert.deepEqual(craft.supportedTargetObjects, ['CUT_PIECE', 'SEMI_FINISHED_GARMENT'], `${craft.craftName} 必须同时支持裁片和成衣`)
  assert.deepEqual(craft.inputObjectTypes, ['CUT_PIECE_PART', 'GARMENT_SEMI'], `${craft.craftName} 投入对象类型错误`)
  assert.deepEqual(craft.outputObjectTypes, ['CUT_PIECE_PART', 'GARMENT_SEMI'], `${craft.craftName} 产出对象类型错误`)
}

const coveredButtonCraft = getProcessCraftByCode('CRAFT_032768')
assert.equal(coveredButtonCraft?.processCode, 'SPECIAL_CRAFT', '布包扣必须建模为辅件制作，不得归入装扣子')
assert.deepEqual(coveredButtonCraft?.inputObjectTypes, ['BOM_MATERIAL'], '布包扣必须投入对应制作物料')
assert.deepEqual(coveredButtonCraft?.outputObjectTypes, ['ACCESSORY'], '布包扣必须产出包布钮辅件')
const coveredButtonOperation = getSpecialCraftOperationById(COVERED_BUTTON_OPERATION_ID)
assert.equal(listEnabledSpecialCraftOperationDefinitions().length, 18, '辅助/特种工艺执行载体必须包含 18 类 operation')
assert.equal(coveredButtonOperation?.craftCode, 'CRAFT_032768', '布包扣 operation 必须绑定权威工艺编码')
assert.equal(coveredButtonOperation?.targetObject, '辅料', '布包扣加工单的产出对象必须是辅料')
assert.equal(coveredButtonOperation?.quantityMode, 'MATERIAL_INPUT_OUTPUT', '布包扣必须区分 BOM 制作物料投入与辅件产出')
assert.equal(coveredButtonOperation?.inputUnit, 'BOM单位', '布包扣投入单位必须取生产单实际 BOM 单位')
assert.equal(coveredButtonOperation?.outputUnit, '个', '包布钮辅件必须按个记录产出')
assert.equal(getSpecialCraftWorkOrderBusinessType(COVERED_BUTTON_OPERATION_ID), 'COVERED_BUTTON_MAKING', '布包扣必须有独立加工单业务类型')
assert(getProcessCraftByCode('CRAFT_3000002')?.craftName === '压褶', '压褶必须保留独立工艺身份')
assert(getProcessCraftByCode('CRAFT_3100003')?.craftName === '打褶', '打褶必须保留独立工艺身份')
assert.equal(getProcessCraftByLegacyValue(262144), undefined, '已淘汰的车缝映射不得保留')
assert.equal(getProcessCraftByCode('CRAFT_3000004')?.craftName, '曲牙绣', '曲牙类只保留曲牙绣')

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
