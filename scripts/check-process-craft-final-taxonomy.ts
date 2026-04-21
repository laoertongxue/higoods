#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  getProcessDefinitionByCode,
  isPostCapacityNode,
  listActiveProcessCraftDefinitions,
  listInactiveProcessCraftDefinitions,
  listProcessDefinitions,
} from '../src/data/fcs/process-craft-dict.ts'

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

const processDefinitions = listProcessDefinitions()
const activeCrafts = listActiveProcessCraftDefinitions()
const inactiveCrafts = listInactiveProcessCraftDefinitions()

assert(!processDefinitions.some((item) => item.processCode === 'WASHING'), '活跃工序中不应保留独立 WASHING')
assert(!processDefinitions.some((item) => item.processCode === 'HARDWARE'), '活跃工序中不应保留五金工序')
assert(!processDefinitions.some((item) => item.processCode === 'FROG_BUTTON'), '活跃工序中不应保留盘扣工序')

const shrinking = getProcessDefinitionByCode('SHRINKING')
assert(shrinking, '缺少缩水工序定义')
assert(shrinking.stageCode === 'PREP', '缩水必须归准备阶段')

const specialCraft = getProcessDefinitionByCode('SPECIAL_CRAFT')
assert(specialCraft, '缺少特殊工艺工序定义')
assert(specialCraft.processRole === 'EXTERNAL_TASK', '特殊工艺必须按对外任务维护')
assert(specialCraft.generatesExternalTask, '特殊工艺必须生成任务')

const washCraft = activeCrafts.find((item) => item.craftName === '洗水')
assert(washCraft, '活跃工艺中缺少洗水')
assert(washCraft.processCode === 'SPECIAL_CRAFT', '洗水必须挂在特殊工艺下')
assert(washCraft.generatesExternalTask, '洗水必须生成任务')
assert(!activeCrafts.some((item) => item.craftName === '印花工艺'), '活跃工艺中不应保留印花工艺')
assert(!activeCrafts.some((item) => item.craftName === '染色工艺'), '活跃工艺中不应保留染色工艺')
assert(!inactiveCrafts.some((item) => item.craftName === '印花工艺'), '历史停用工艺中不应保留印花工艺伪映射')
assert(!inactiveCrafts.some((item) => item.craftName === '染色工艺'), '历史停用工艺中不应保留染色工艺伪映射')

const postFinishing = getProcessDefinitionByCode('POST_FINISHING')
assert(postFinishing, '缺少后道父任务定义')
assert(postFinishing.processRole === 'EXTERNAL_TASK', '后道父任务必须按对外任务维护')
assert(postFinishing.generatesExternalTask, '后道父任务必须生成任务')
assert(postFinishing.requiresTaskQr, '后道父任务必须生成任务二维码')
assert(postFinishing.requiresHandoverOrder, '后道父任务必须生成交出单')
assert(postFinishing.capacityRollupMode === 'CHILD_NODES', '后道父任务必须按子节点汇总产能')

for (const processCode of ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING']) {
  const node = getProcessDefinitionByCode(processCode)
  assert(node, `缺少后道产能节点 ${processCode}`)
  assert(node.parentProcessCode === 'POST_FINISHING', `${processCode} 必须挂在后道父任务下`)
  assert(node.processRole === 'INTERNAL_CAPACITY_NODE', `${processCode} 必须是产能节点`)
  assert(isPostCapacityNode(processCode), `${processCode} 必须被识别为后道产能节点`)
  assert(!node.generatesExternalTask, `${processCode} 不得生成独立任务`)
  assert(!node.requiresTaskQr, `${processCode} 不得生成独立任务二维码`)
  assert(!node.requiresHandoverOrder, `${processCode} 不得生成独立交出单`)
}

assert(!activeCrafts.some((item) => item.craftName === '鸡眼扣'), '活跃工艺中不应保留鸡眼扣')
assert(!activeCrafts.some((item) => item.craftName === '手工盘扣'), '活跃工艺中不应保留手工盘扣')
assert(inactiveCrafts.some((item) => item.craftName === '鸡眼扣'), '历史工艺中应保留鸡眼扣停用映射')
assert(inactiveCrafts.some((item) => item.craftName === '手工盘扣'), '历史工艺中应保留手工盘扣停用映射')

const craftDictPage = read('src/pages/production-craft-dict.ts')
const taskBreakdownPage = read('src/pages/task-breakdown.ts')
const factoryMockSource = read('src/data/fcs/factory-mock-data.ts')
const capacityProfileMockSource = read('src/data/fcs/factory-capacity-profile-mock.ts')

assert(!craftDictPage.includes('>WASHING<'), '工序工艺字典页面不应直显 WASHING')
assert(!craftDictPage.includes('>HARDWARE<'), '工序工艺字典页面不应直显 HARDWARE')
assert(!craftDictPage.includes('>FROG_BUTTON<'), '工序工艺字典页面不应直显 FROG_BUTTON')
assert(taskBreakdownPage.includes('开扣眼、装扣子、熨烫、包装'), '任务分解页缺少后道产能节点口径')
assert(factoryMockSource.includes('特殊工艺 - 洗水'), '工厂能力数据缺少特殊工艺 - 洗水')
assert(capacityProfileMockSource.includes('BUTTONHOLE'), '工厂产能档案缺少开扣眼节点')
assert(capacityProfileMockSource.includes('BUTTON_ATTACH'), '工厂产能档案缺少装扣子节点')
assert(capacityProfileMockSource.includes('IRONING'), '工厂产能档案缺少熨烫节点')
assert(capacityProfileMockSource.includes('PACKAGING'), '工厂产能档案缺少包装节点')

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
