#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  generateProductionArtifactsForOrder,
  listGeneratedProductionPreparationOrderArtifacts,
} from '../src/data/fcs/production-artifact-generation.ts'
import { listProcessCraftDictRows, listProcessDefinitions } from '../src/data/fcs/process-craft-dict.ts'
import {
  assertNoRemovedLegacyTerm,
  removedLegacyCraftNames,
  removedLegacyProcessCodes,
} from './utils/special-craft-banlist.ts'
import {
  handleProductionCraftDictEvent,
  isProductionCraftDictDialogOpen,
  renderProductionCraftDictPage,
} from '../src/pages/production-craft-dict.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

function includesAll(source: string, terms: string[], message: string): void {
  const missing = terms.filter((term) => !source.includes(term))
  assert(missing.length === 0, `${message}：缺少 ${missing.join('、')}`)
}

;(globalThis as typeof globalThis & { HTMLInputElement?: unknown }).HTMLInputElement ??= class {}
;(globalThis as typeof globalThis & { HTMLSelectElement?: unknown }).HTMLSelectElement ??= class {}

try {
  const craftDictPageSource = readSource('src/pages/production-craft-dict.ts')
  const taskBreakdownSource = readSource('src/pages/task-breakdown.ts')

  includesAll(
    craftDictPageSource,
    [
      '阶段', '工序', '工艺', '作用对象', '任务口径', '是否出生产任务', '状态',
      'data-craft-dict-field="keyword"', 'data-craft-dict-field="stage"', 'data-craft-dict-field="status"',
    ],
    '工序工艺字典页面字段或筛选不完整',
  )
  includesAll(
    craftDictPageSource,
    [
      '准备阶段只生成对应加工单',
      '不进入生产任务清单、任务分配或合并任务',
      '质检、复检是回货流程节点，不是工序',
      '后道阶段仅包含开扣眼、装扣子、烫包',
      '不作为任务合并判断条件',
    ],
    '工序工艺字典页面缺少阶段与任务边界',
  )
  assert(!craftDictPageSource.includes('产值计算'), '工序工艺字典不得保留产值计算逻辑')
  assert(!craftDictPageSource.includes('连续型'), '工序工艺字典不得保留连续型逻辑')

  includesAll(
    taskBreakdownSource,
    [
      '生产准备工序不进入任务清单',
      '合并任务仅支持车缝+烫包、裁剪+车缝+烫包',
      'isAssignableProductionExecutionTask',
    ],
    '任务清单未按当前任务边界收口',
  )
  assert(!taskBreakdownSource.includes('POST_FINISHING'), '任务清单不得再引入通用“后道任务”')

  const processDefinitions = listProcessDefinitions()
  const activeRows = listProcessCraftDictRows()
  const historicalRows = listProcessCraftDictRows(true).filter((row) => !row.isActive)
  const removedCraftNameSet = new Set(removedLegacyCraftNames)
  const pageHtml = renderProductionCraftDictPage()

  assert(pageHtml.includes('查看基础工序顺序'), '页面缺少基础工序顺序入口')
  assert(!pageHtml.includes('产值计算'), '渲染结果不得暴露产值计算')
  assert(activeRows.every((row) => row.isActive), '默认字典只应包含可用项')
  removedLegacyProcessCodes.forEach((processCode) => {
    assert(!activeRows.some((row) => row.processCode === processCode), '默认字典不应出现已删除旧编码')
  })
  assert(!activeRows.some((row) => removedCraftNameSet.has(row.craftName)), '默认字典不应显示已删除旧项')
  assert(!historicalRows.some((row) => removedCraftNameSet.has(row.craftName)), '历史停用区不应保留已删除旧项')

  const prepProcesses = processDefinitions.filter((item) => item.stageCode === 'PREP')
  assert(prepProcesses.length > 0, '缺少生产准备阶段工序')
  prepProcesses.forEach((processDefinition) => {
    assert(processDefinition.processRole === 'PREPARATION_ORDER', `${processDefinition.processName} 必须定义为生产准备单`)
    assert(!processDefinition.generatesExternalTask, `${processDefinition.processName} 不得生成对外任务`)
    assert(processDefinition.defaultDocType === 'PREPARATION_ORDER', `${processDefinition.processName} 默认单据必须是加工单`)
  })
  activeRows.filter((row) => row.stageCode === 'PREP').forEach((row) => {
    assert(row.taskScopeLabel === '生产准备加工单', `${row.craftName} 的任务口径错误`)
    assert(row.generatesExternalTaskLabel === '否', `${row.craftName} 不得生成生产任务`)
    assert(row.defaultDocType === 'PREPARATION_ORDER', `${row.craftName} 默认单据必须是加工单`)
  })

  const activePostProcessCodes = processDefinitions
    .filter((item) => item.stageCode === 'POST' && item.isActive)
    .map((item) => item.processCode)
  assert(
    JSON.stringify(activePostProcessCodes) === JSON.stringify(['BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK']),
    '后道阶段必须且只能包含开扣眼、装扣子、烫包',
  )
  for (const processCode of ['BUTTONHOLE', 'BUTTON_ATTACH']) {
    activeRows.filter((row) => row.processCode === processCode).forEach((row) => {
      assert(row.taskScopeLabel === '产能节点', `${row.processName} 必须作为后道阶段内部节点`)
      assert(row.generatesExternalTaskLabel === '否', `${row.processName} 不得生成独立任务`)
    })
  }
  const activeIronPackRows = activeRows.filter((row) => row.processCode === 'IRON_PACK')
  assert(activeIronPackRows.length === 1 && activeIronPackRows[0].craftName === '烫包', '当前口径只能保留烫包，熨烫/包装只能作为历史归一映射')
  assert(activeIronPackRows[0].generatesExternalTaskLabel === '是', '独立烫包必须可生成生产任务')
  assert(!activeRows.some((row) => ['熨烫', '包装'].includes(row.craftName)), '可用字典不得暴露熨烫/包装旧名称')
  assert(!processDefinitions.some((item) => ['QUALITY_INSPECTION', 'RECHECK'].includes(item.processCode)), '质检、复检不得进入工序字典')
  assertNoRemovedLegacyTerm(craftDictPageSource, assert, '工序工艺字典页面源码不应保留已删除旧项')

  const openHandled = handleProductionCraftDictEvent({
    closest(selector: string) {
      if (selector === '[data-craft-dict-field]') return null
      if (selector === '[data-craft-dict-action]') return { dataset: { craftDictAction: 'open-route-order' } }
      return null
    },
  } as unknown as HTMLElement)
  assert(openHandled && isProductionCraftDictDialogOpen(), '基础工序顺序弹窗必须可打开')
  const routeDialogHtml = renderProductionCraftDictPage()
  assert(routeDialogHtml.includes('基础工序顺序'), '基础工序顺序弹窗缺少标题')
  assert(routeDialogHtml.includes('不作为任务合并判断条件'), '基础顺序不得恢复为连续工序合并规则')
  handleProductionCraftDictEvent({
    closest(selector: string) {
      if (selector === '[data-craft-dict-field]') return null
      if (selector === '[data-craft-dict-action]') return { dataset: { craftDictAction: 'close-route-order' } }
      return null
    },
  } as unknown as HTMLElement)
  assert(!isProductionCraftDictDialogOpen(), '基础工序顺序弹窗必须可关闭')

  const artifacts = ['PO-202603-0002', 'PO-202603-0015']
    .flatMap((orderId) => generateProductionArtifactsForOrder(orderId))
  const taskArtifacts = artifacts.filter((item) => item.artifactType === 'TASK')
  const preparationOrderArtifacts = listGeneratedProductionPreparationOrderArtifacts()
  assert(preparationOrderArtifacts.length > 0, '生产准备工序必须生成加工单')
  assert(preparationOrderArtifacts.every((item) => item.stageCode === 'PREP'), '生产准备单必须归准备阶段')
  assert(taskArtifacts.every((item) => item.stageCode !== 'PREP'), '生产准备工序不得生成生产任务')
  assert(!taskArtifacts.some((item) => ['BUTTONHOLE', 'BUTTON_ATTACH'].includes(item.processCode)), '开扣眼、装扣子不得生成独立任务')
  assert(!taskArtifacts.some((item) => item.processCode === 'POST_FINISHING'), '不得生成通用“后道任务”')

  console.log(JSON.stringify({
    页面字段口径: '已校验',
    生产准备单边界: '已校验',
    默认可用工艺数: activeRows.length,
    历史停用工艺数: historicalRows.length,
    后道阶段三工序: '已校验',
  }, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
