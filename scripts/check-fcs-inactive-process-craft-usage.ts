#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getProcessCraftByCode,
  listInactiveProcessCraftDefinitions,
  listProcessCraftDefinitions,
} from '../src/data/fcs/process-craft-dict.ts'
import { routingTemplates } from '../src/data/fcs/routing-templates.ts'
import { techPacks } from '../src/data/fcs/tech-packs.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const RETIRED_PROCESS_CODES = ['WASHING', 'HARDWARE', 'FROG_BUTTON'] as const
const SAFE_SOURCE_FILES = new Set([
  'src/data/fcs/process-craft-dict.ts',
  'src/data/fcs/process-craft-sam-explainer.ts',
  'src/pages/production-craft-dict.ts',
])

function resolveRepoPath(relativePath: string): string {
  return path.join(ROOT, relativePath)
}

function read(relativePath: string): string {
  return fs.readFileSync(resolveRepoPath(relativePath), 'utf8')
}

function walk(relativeDir: string): string[] {
  const absoluteDir = resolveRepoPath(relativeDir)
  const files: string[] = []
  const queue = [absoluteDir]
  while (queue.length > 0) {
    const current = queue.pop()
    if (!current || !fs.existsSync(current)) continue
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(next)
        continue
      }
      if (/\.(ts|tsx)$/.test(entry.name)) {
        files.push(path.relative(ROOT, next).split(path.sep).join('/'))
      }
    }
  }
  return files.sort()
}

const inactiveCraftNames = Array.from(
  new Set(listInactiveProcessCraftDefinitions().map((item) => item.craftName)),
)
const activeCraftCodes = new Set(listProcessCraftDefinitions().map((item) => item.craftCode))
const bannedSourceTokens = [...inactiveCraftNames, '盘扣', ...RETIRED_PROCESS_CODES]

const scanFiles = [...walk('src/data/fcs'), ...walk('src/pages')]
  .filter((file) => !SAFE_SOURCE_FILES.has(file))

for (const file of scanFiles) {
  const source = read(file)
  for (const token of bannedSourceTokens) {
    assert(!source.includes(token), `${file} 仍包含停用工艺/工序口径：${token}`)
  }
}

for (const techPack of techPacks) {
  for (const entry of techPack.processEntries ?? []) {
    if (!entry.craftCode) continue
    const craft = getProcessCraftByCode(entry.craftCode)
    assert(craft, `${techPack.spuCode} / ${entry.id} 缺少工艺字典定义`)
    assert(craft.isActive, `${techPack.spuCode} / ${entry.id} 使用了历史停用工艺：${craft.craftName}`)
    assert(activeCraftCodes.has(entry.craftCode), `${techPack.spuCode} / ${entry.id} 使用了非活跃工艺编码：${entry.craftCode}`)
  }
}

for (const template of routingTemplates) {
  const snapshot = JSON.stringify(template)
  for (const token of bannedSourceTokens) {
    assert(!snapshot.includes(token), `${template.templateId} 仍包含停用工艺/工序口径：${token}`)
  }
}

const techPackDataSource = read('src/data/fcs/tech-packs.ts')
assert(
  techPackDataSource.includes('listProcessCraftDefinitions().map'),
  '技术包演示数据构造未限定为活跃工艺字典',
)
assert(
  !techPackDataSource.includes('listAllProcessCraftDefinitions().map'),
  '技术包演示数据构造仍在使用全部工艺字典',
)

const techPackContextSource = read('src/pages/tech-pack/context.ts')
assert(
  !techPackContextSource.includes('listAllProcessCraftDefinitions().find((craftItem) => craftItem.craftName === item.name)'),
  '技术包页面仍会用全部工艺字典回填历史停用工艺',
)

console.log(
  `已校验 ${techPacks.length} 个技术包、${routingTemplates.length} 个工艺路线模板，FCS 演示数据未使用历史停用工艺/工序。`,
)
