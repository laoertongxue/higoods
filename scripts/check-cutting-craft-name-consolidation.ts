#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  listActiveProcessCraftDefinitions,
  listCuttingCrafts,
  listSpecialTypeCrafts,
} from '../src/data/fcs/process-craft-dict.ts'
import { listSpecialCraftOperationDefinitions } from '../src/data/fcs/special-craft-operations.ts'
import { routingTemplates } from '../src/data/fcs/routing-templates.ts'
import { renderProductionCraftDictPage } from '../src/pages/production-craft-dict.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const canonicalName = '定位裁（激光切）'
const deprecatedPositioningName = canonicalName.slice(0, 3)
const deletedSpecialCraftName = canonicalName.slice(4, -1)
const deprecatedAlias = `${deletedSpecialCraftName.slice(0, 2)}${deprecatedPositioningName}`
const deletedProcessCode = ['PROC', 'LASER', 'CUT'].join('_')
const deprecatedCuttingCraftCode = ['CUTTING', 'LASER', 'POSITIONING'].join('_')
const includeGeneratedDist = process.argv.includes('--include-dist')

function listDirectoryFiles(directoryPath: string): string[] {
  if (!fs.existsSync(directoryPath)) return []
  const files: string[] = []
  const queue = [directoryPath]
  while (queue.length > 0) {
    const current = queue.pop()
    if (!current) continue
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name)
      if (entry.isDirectory()) queue.push(absolutePath)
      if (entry.isFile()) files.push(absolutePath)
    }
  }
  return files
}

function listProjectFiles(): string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: repoRoot, encoding: 'utf8' },
  )
  const sourceFiles = output
    .split('\0')
    .filter(Boolean)
    .map((relativePath) => path.join(repoRoot, relativePath))
  const generatedFiles = includeGeneratedDist ? listDirectoryFiles(path.join(repoRoot, 'dist')) : []
  return [...new Set([...sourceFiles, ...generatedFiles])].sort()
}

function stripCanonicalName(value: string): string {
  return value.split(canonicalName).join('')
}

function assertNoDeprecatedTerms(value: string, location: string): void {
  const withoutCanonicalName = stripCanonicalName(value)
  assert(!withoutCanonicalName.includes(deprecatedPositioningName), `${location} 仍残留旧裁床工艺名称`)
  assert(!withoutCanonicalName.includes(deletedSpecialCraftName), `${location} 仍残留已删除特种工艺名称`)
  assert(!withoutCanonicalName.includes(deprecatedAlias), `${location} 仍残留旧裁床工艺别名`)
  assert(!value.includes(deletedProcessCode), `${location} 仍残留已删除特种工艺内部编码`)
  assert(!value.includes(deprecatedCuttingCraftCode), `${location} 仍残留旧裁床工艺内部编码`)
}

for (const absolutePath of listProjectFiles()) {
  const relativePath = path.relative(repoRoot, absolutePath).split(path.sep).join('/')
  assertNoDeprecatedTerms(relativePath, `文件名 ${relativePath}`)

  const stat = fs.statSync(absolutePath)
  if (stat.size > 5 * 1024 * 1024) continue
  const buffer = fs.readFileSync(absolutePath)
  if (buffer.includes(0)) continue
  assertNoDeprecatedTerms(buffer.toString('utf8'), relativePath)
}

const activeCrafts = listActiveProcessCraftDefinitions()
const positioningCraft = activeCrafts.find((craft) => craft.legacyValue === 1)
assert(positioningCraft, '工序工艺字典缺少定位类裁床工艺')
assert.equal(positioningCraft.craftName, canonicalName, '定位类裁床工艺名称未统一')
assert.equal(positioningCraft.legacyCraftName, canonicalName, '定位类裁床历史名称未统一')
assert.equal(positioningCraft.processCode, 'CUT_PANEL', '定位类裁床工艺必须继续归属裁片工序')
assert.equal(positioningCraft.isSpecialCraft, false, '定位类裁床工艺不得归入特种工艺')
assert(!activeCrafts.some((craft) => craft.legacyValue === 64), '工序工艺字典仍存在已删除的 value 64 工艺')

const cuttingCraftNames = listCuttingCrafts().map((craft) => craft.craftName)
assert(cuttingCraftNames.includes(canonicalName), '裁床工艺清单缺少统一后的定位类裁法')
assert(!listSpecialTypeCrafts().some((craft) => craft.craftName === deletedSpecialCraftName), '特种工艺清单仍存在已删除旧项')
assert(
  !listSpecialCraftOperationDefinitions().some((operation) => operation.operationName === deletedSpecialCraftName),
  '特种工艺加工单运营定义仍存在已删除旧项',
)

const positioningEmbroideryTemplate = routingTemplates.find((template) => template.templateId === 'RT-202603-0006')
assert(positioningEmbroideryTemplate, '缺少定位类裁法与绣花路线模板')
assert.equal(positioningEmbroideryTemplate.steps[0]?.processCode, 'PROC_CUT', '路线模板首步必须是裁床工序')
assert.equal(positioningEmbroideryTemplate.steps[0]?.craftName, canonicalName, '路线模板裁床步骤未标明统一后的裁法')
assert(
  !JSON.stringify(positioningEmbroideryTemplate).includes(deletedProcessCode),
  '路线模板仍存在已删除的独立特种工艺步骤',
)

const pageHtml = renderProductionCraftDictPage()
assert(pageHtml.includes(canonicalName), '工序工艺字典页面没有显示统一后的名称')
assertNoDeprecatedTerms(pageHtml, '工序工艺字典页面')

console.log('cutting craft name consolidation checks passed')
