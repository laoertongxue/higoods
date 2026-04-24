#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import {
  listActiveProcessCraftDefinitions,
  listSelectableSpecialCraftDefinitions,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  buildSpecialCraftStatisticsPath,
  buildSpecialCraftTaskOrdersPath,
  buildSpecialCraftWarehousePath,
  listEnabledSpecialCraftOperationDefinitions,
  listSpecialCraftOperationDefinitions,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  includesRemovedLegacyTerm,
  removedCraftNameSet,
  removedLegacyCraftNames,
  removedLegacyProcessCodes,
  removedPseudoCraftNames,
} from './utils/special-craft-banlist.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const excludedDirs = new Set(['node_modules', 'dist', '.git', '.vite', 'coverage'])

function resolveRepoPath(relativePath: string): string {
  return path.join(repoRoot, relativePath)
}

function read(relativePath: string): string {
  return fs.readFileSync(resolveRepoPath(relativePath), 'utf8')
}

function walk(relativePath: string): string[] {
  const absolutePath = resolveRepoPath(relativePath)
  if (!fs.existsSync(absolutePath)) return []
  const files: string[] = []
  const queue = [absolutePath]

  while (queue.length > 0) {
    const current = queue.pop()
    if (!current) continue
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (!excludedDirs.has(entry.name)) queue.push(next)
        continue
      }
      files.push(path.relative(repoRoot, next).split(path.sep).join('/'))
    }
  }

  return files.sort()
}

function flattenMenuItems(groups: typeof menusBySystem.pfos) {
  return groups.flatMap((group) => group.items)
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

function main(): void {
  const scanFiles = [
    ...walk('src'),
    ...walk('scripts'),
    ...walk('docs'),
    'package.json',
  ]

  scanFiles.forEach((file) => {
    const source = read(file)
    const hit = includesRemovedLegacyTerm(source)
    assert(!hit, `${file} 仍残留已删除旧项`)
  })

  const activeCrafts = listActiveProcessCraftDefinitions()
  const selectableSpecialCrafts = listSelectableSpecialCraftDefinitions()
  const selectableSpecialCraftCodes = new Set(selectableSpecialCrafts.map((item) => item.craftCode))
  const activeCraftNames = new Set(activeCrafts.map((item) => item.craftName))
  const specialCraftOperations = listSpecialCraftOperationDefinitions()
  const enabledOperations = listEnabledSpecialCraftOperationDefinitions()
  const allowedTargetLabels = new Set(['已裁部位', '完整面料'])

  assert(
    !activeCrafts.some((item) => removedCraftNameSet.has(item.craftName)),
    '工序工艺字典活跃工艺仍含已删除旧项',
  )
  assert(
    !activeCrafts.some((item) => removedLegacyProcessCodes.includes(item.processCode)),
    '工序工艺字典活跃工序仍含已删除旧编码',
  )
  assert(
    !selectableSpecialCrafts.some((item) => removedPseudoCraftNames.includes(item.craftName)),
    '特殊工艺字典仍含伪特殊工艺项',
  )
  assert(specialCraftOperations.length > 0, '缺少特殊工艺运营分类基础数据')
  assert(
    selectableSpecialCrafts.every((item) =>
      Array.isArray(item.supportedTargetObjects)
      && item.supportedTargetObjects.length > 0
      && item.supportedTargetObjectLabels.every((label) => allowedTargetLabels.has(label))),
    '特殊工艺字典必须维护多选作用对象，且只允许已裁部位 / 完整面料',
  )
  assert(
    specialCraftOperations.every((item) =>
      Array.isArray(item.supportedTargetObjects)
      && item.supportedTargetObjects.length > 0
      && item.supportedTargetObjectLabels.every((label) => allowedTargetLabels.has(label))
      && allowedTargetLabels.has(item.defaultTargetObject)),
    '特殊工艺运营分类必须继承多选作用对象并保留合法默认值',
  )
  assert(
    specialCraftOperations.every((item) =>
      selectableSpecialCraftCodes.has(item.craftCode)
      && activeCraftNames.has(item.craftName)
      && item.processCode === 'SPECIAL_CRAFT'
      && !removedLegacyCraftNames.includes(item.craftName)),
    '特殊工艺运营分类存在非法引用',
  )
  const specialCraftMenuGroup = menusBySystem.pfos.find((group) => group.title === '特殊工艺')
  assert(specialCraftMenuGroup, '工艺工厂运营系统缺少特殊工艺菜单组')
  const pfosItems = flattenMenuItems(menusBySystem.pfos)
  enabledOperations.forEach((operation) => {
    const menuItem = specialCraftMenuGroup!.items.find((item) => item.title === operation.operationName)
    assert(menuItem, `${operation.operationName} 缺少一级菜单`)
    assert(menuItem!.children?.some((child) => child.href === buildSpecialCraftTaskOrdersPath(operation)), `${operation.operationName} 缺少任务单菜单`)
    assert(menuItem!.children?.some((child) => child.href === buildSpecialCraftWarehousePath(operation)), `${operation.operationName} 缺少仓库管理菜单`)
    assert(menuItem!.children?.some((child) => child.href === buildSpecialCraftStatisticsPath(operation)), `${operation.operationName} 缺少统计菜单`)
  })
  assert(
    !pfosItems.some((item) => item.key.includes('pfos-special') && item.title.includes(buildToken('印', '花'))),
    `${buildToken('印', '花')}不应挂入特殊工艺菜单`,
  )
  assert(
    !pfosItems.some((item) => item.key.includes('pfos-special') && item.title.includes(buildToken('染', '色'))),
    `${buildToken('染', '色')}不应挂入特殊工艺菜单`,
  )

  const printingSource =
    read('src/data/fcs/printing-task-domain.ts')
    + read('src/pages/process-factory/printing/work-orders.ts')
    + read('src/pages/process-factory/printing/statistics.ts')
    + read('src/pages/process-factory/printing/dashboards.ts')
  ;['印花加工单', '印花任务', '印花统计', '印花大屏'].forEach((token) => {
    assert(printingSource.includes(token), `独立模块缺少：${token}`)
  })

  const dyeingSource =
    read('src/data/fcs/dyeing-task-domain.ts')
    + read('src/pages/process-factory/dyeing/work-orders.ts')
    + read('src/pages/process-factory/dyeing/dye-orders.ts')
    + read('src/pages/process-factory/dyeing/reports.ts')
  ;['染色加工单', '染色任务', '染色配方', '染色报表'].forEach((token) => {
    assert(dyeingSource.includes(token), `独立模块缺少：${token}`)
  })

  console.log('check-special-craft-business-taxonomy.ts PASS')
}

main()
