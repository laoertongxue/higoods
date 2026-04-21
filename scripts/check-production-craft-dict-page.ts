#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { generateProductionArtifactsForOrder } from '../src/data/fcs/production-artifact-generation.ts'
import { listProcessCraftDictRows } from '../src/data/fcs/process-craft-dict.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

function includesAll(source: string, terms: string[], message: string): void {
  const missing = terms.filter((term) => !source.includes(term))
  assert(missing.length === 0, `${message}：缺少 ${missing.join('、')}`)
}

function excludesAll(source: string, terms: string[], message: string): void {
  const hit = terms.find((term) => source.includes(term))
  assert(!hit, `${message}：${hit}`)
}

try {
  const craftDictPageSource = readSource('src/pages/production-craft-dict.ts')
  const taskBreakdownSource = readSource('src/pages/task-breakdown.ts')

  includesAll(
    craftDictPageSource,
    ['工序名称', '工艺名称', '阶段', '任务口径', '是否生成任务', '状态', '可用', '历史停用'],
    '工序工艺字典页面字段口径不完整',
  )
  includesAll(
    craftDictPageSource,
    ['data-craft-dict-field="filterStatus"', '任务口径', '是否生成任务'],
    '工序工艺字典页面缺少状态与任务口径筛选',
  )
  excludesAll(
    craftDictPageSource,
    ['>EXTERNAL_TASK<', '>INTERNAL_CAPACITY_NODE<', '>deprecated<', '>HISTORICAL_ONLY<'],
    '工序工艺字典页面仍直接渲染研发枚举',
  )

  includesAll(
    taskBreakdownSource,
    ['内含：', '开扣眼、装扣子、熨烫、包装', 'isExternalTaskProcess'],
    '任务分解页未按后道父任务口径收口',
  )
  excludesAll(
    taskBreakdownSource,
    ['后道内部记录', '折叠区'],
    '任务分解页出现越界后道详情结构',
  )

  const activeRows = listProcessCraftDictRows()
  const historicalRows = listProcessCraftDictRows(true).filter((row) => !row.isActive)

  assert(activeRows.every((row) => row.isActive), '默认工序工艺字典列表应只包含可用项')
  assert(!activeRows.some((row) => row.processCode === 'WASHING'), '默认字典中不应存在活跃独立洗水工序')
  assert(!activeRows.some((row) => row.processCode === 'HARDWARE'), '默认字典中不应存在活跃五金工序')
  assert(!activeRows.some((row) => row.processCode === 'FROG_BUTTON'), '默认字典中不应存在活跃盘扣工序')
  assert(!activeRows.some((row) => row.craftName === '鸡眼扣'), '默认字典中不应显示鸡眼扣')
  assert(!activeRows.some((row) => row.craftName === '手工盘扣'), '默认字典中不应显示手工盘扣')

  const washRow = activeRows.find((row) => row.craftName === '洗水')
  assert(washRow, '默认字典中缺少洗水工艺')
  assert(washRow.processCode === 'SPECIAL_CRAFT', '洗水必须挂在特殊工艺下')
  assert(washRow.processName === '特殊工艺', '洗水工艺所属工序名称必须为特殊工艺')
  assert(washRow.taskScopeLabel === '对外任务', '洗水必须按对外任务展示')
  assert(washRow.generatesExternalTaskLabel === '是', '洗水必须生成对外任务')

  const buttonholeRows = activeRows.filter((item) => item.processCode === 'BUTTONHOLE')
  assert(buttonholeRows.length > 0, '默认字典缺少开扣眼产能节点')
  buttonholeRows.forEach((row) => {
    assert(row.stageName === '后道阶段', '开扣眼必须位于后道阶段')
    assert(row.taskScopeLabel === '产能节点', '开扣眼必须按产能节点展示')
    assert(row.generatesExternalTaskLabel === '否', '开扣眼不得生成独立任务')
  })

  const buttonAttachRows = activeRows.filter((item) => item.processCode === 'BUTTON_ATTACH')
  assert(buttonAttachRows.length > 0, '默认字典缺少装扣子产能节点')
  buttonAttachRows.forEach((row) => {
    assert(row.processName === '装扣子', '装扣子主业务名称必须统一')
    assert(row.stageName === '后道阶段', '装扣子必须位于后道阶段')
    assert(row.taskScopeLabel === '产能节点', '装扣子必须按产能节点展示')
    assert(row.generatesExternalTaskLabel === '否', '装扣子不得生成独立任务')
  })

  for (const craftName of ['熨烫', '包装']) {
    const row = activeRows.find((item) => item.craftName === craftName)
    assert(row, `默认字典缺少后道产能节点 ${craftName}`)
    assert(row.stageName === '后道阶段', `${craftName} 必须位于后道阶段`)
    assert(row.taskScopeLabel === '产能节点', `${craftName} 必须按产能节点展示`)
    assert(row.generatesExternalTaskLabel === '否', `${craftName} 不得生成独立任务`)
  }

  const chickenEyeRow = historicalRows.find((row) => row.craftName === '鸡眼扣')
  const frogButtonRow = historicalRows.find((row) => row.craftName === '手工盘扣')
  assert(chickenEyeRow?.statusLabel === '历史停用', '鸡眼扣必须按历史停用展示')
  assert(chickenEyeRow?.generatesExternalTask === false, '鸡眼扣不得生成新任务')
  assert(frogButtonRow?.statusLabel === '历史停用', '手工盘扣必须按历史停用展示')
  assert(frogButtonRow?.generatesExternalTask === false, '手工盘扣不得生成新任务')

  const orderIds = ['PO-202603-0002', 'PO-202603-0015']
  const artifacts = orderIds.flatMap((orderId) => generateProductionArtifactsForOrder(orderId))
  const taskArtifacts = artifacts.filter((item) => item.artifactType === 'TASK')

  const postTask = taskArtifacts.find((item) => item.processCode === 'POST_FINISHING')
  assert(postTask, '任务生成结果中必须存在后道父任务')
  assert(postTask.taskScope === 'POST_ROLLUP_TASK', '后道父任务必须按后道汇总任务生成')
  assert((postTask.rolledUpChildProcessNames?.length ?? 0) > 0, '后道父任务必须带出汇总的子节点名称')
  assert(
    !taskArtifacts.some((item) => ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'].includes(item.processCode)),
    '任务生成结果中不应包含后道产能节点独立任务',
  )

  console.log(
    JSON.stringify(
      {
        页面字段口径: '已校验',
        默认可用工艺数: activeRows.length,
        历史停用工艺数: historicalRows.length,
        后道父任务生成: '已校验',
      },
      null,
      2,
    ),
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
