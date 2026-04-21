#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function resolveRepoPath(...segments: string[]): string {
  return path.join(ROOT, ...segments)
}

function read(relativePath: string): string {
  return fs.readFileSync(resolveRepoPath(relativePath), 'utf8')
}

function readIfExists(relativePath: string): string {
  const absolutePath = resolveRepoPath(relativePath)
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : ''
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function existingPaths(paths: string[]): string[] {
  return paths.filter((item) => fs.existsSync(resolveRepoPath(item)))
}

function walk(relativeDir: string, allowPattern = /\.(ts|tsx|js|jsx|mjs)$/): string[] {
  const absoluteDir = resolveRepoPath(relativeDir)
  if (!fs.existsSync(absoluteDir)) return []
  const result: string[] = []
  const queue = [absoluteDir]
  while (queue.length > 0) {
    const current = queue.pop()
    if (!current) continue
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(next)
        continue
      }
      if (allowPattern.test(entry.name)) {
        result.push(path.relative(ROOT, next).split(path.sep).join('/'))
      }
    }
  }
  return result.sort()
}

function assertNoMatch(source: string, pattern: RegExp, message: string): void {
  assert(!pattern.test(source), message)
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

const hardcodedPathPattern = new RegExp(
  [
    ['/U', 'sers/'].join(''),
    ['Documents', '/higoods'].join(''),
    ['/mnt', '/data/latest_code'].join(''),
    ['/pri', 'vate/'].join(''),
    ['C:', '\\\\'].join(''),
    ['Users', '\\\\'].join(''),
  ]
    .map((item) => escapeRegExp(item))
    .join('|'),
)
const scriptFiles = walk('scripts')
const packageSource = read('package.json')

for (const file of [...scriptFiles, 'package.json']) {
  const source = file === 'package.json' ? packageSource : read(file)
  assertNoMatch(source, hardcodedPathPattern, `${file} 仍包含硬编码本地路径`)
}

const legacyCheckSource = read('scripts/check-legacy-terminology-cleanup.ts')
assertIncludes(legacyCheckSource, "listDirectoryFiles('tests'", 'legacy 检查缺少 tests 目录安全扫描')
assertIncludes(legacyCheckSource, "if (!fs.existsSync(absoluteDir)) return []", 'legacy 检查缺少不存在目录保护')
assertIncludes(legacyCheckSource, "walkFiles('src/pages')", 'legacy 检查缺少 src/pages 扫描')
assertIncludes(legacyCheckSource, "walkFiles('src/components')", 'legacy 检查缺少 src/components 扫描')
assertIncludes(legacyCheckSource, "walkFiles('docs'", 'legacy 检查缺少 docs 扫描')

const visibleQrFiles = existingPaths([
  'src/pages/process-factory/cutting/material-prep.ts',
  'src/pages/process-factory/cutting/transfer-bags.ts',
  'src/pages/pda-cutting-shared.ts',
  'src/pages/pda-cutting-pickup.ts',
  'src/pages/pda-cutting-task-detail.ts',
  'src/pages/pda-handover-detail.ts',
  'src/pages/progress-material.ts',
  'src/pages/progress-cutting-exception-center.ts',
  'src/pages/progress-exceptions/detail-domain.ts',
  'src/pages/settlement-cutting-input.ts',
]).map((file) => read(file))
const qrVisibleSource = visibleQrFiles.join('\n')
assertNoMatch(qrVisibleSource, /FCS:/, '页面仍直接显示二维码 payload')
assertNoMatch(qrVisibleSource, /QR payload/, '页面仍直接显示 QR payload 文案')
assertNoMatch(qrVisibleSource, /正式二维码值|裁片单主码|二维码值/, '页面仍直接显示二维码原始值标签')

const shortCopyFiles = existingPaths([
  'src/pages/process-factory/printing/work-orders.ts',
  'src/pages/process-factory/printing/progress.ts',
  'src/pages/process-factory/printing/pending-review.ts',
  'src/pages/process-factory/printing/statistics.ts',
  'src/pages/process-factory/printing/dashboards.ts',
  'src/pages/process-factory/dyeing/work-orders.ts',
  'src/pages/process-factory/dyeing/dye-orders.ts',
  'src/pages/process-factory/dyeing/reports.ts',
  'src/pages/process-factory/cutting/material-prep.ts',
  'src/pages/process-factory/cutting/fabric-warehouse.ts',
  'src/pages/process-factory/cutting/cut-piece-warehouse.ts',
  'src/pages/process-factory/cutting/replenishment.ts',
  'src/pages/process-factory/cutting/production-progress.ts',
  'src/pages/process-factory/cutting/cutting-summary.ts',
  'src/pages/process-factory/cutting/fei-tickets.ts',
  'src/pages/process-factory/cutting/transfer-bags.ts',
  'src/pages/process-factory/cutting/sample-warehouse.ts',
]).map((file) => read(file))
const shortCopySource = shortCopyFiles.join('\n')
assertNoMatch(shortCopySource, /本页用于|该页面用于|工厂端移动应用执行|完整 WMS|业务口径/, '工厂端页面仍保留说明性长文案')

const materialPrepPage = read('src/pages/process-factory/cutting/material-prep.ts')
const materialPrepData = read('src/data/fcs/cutting/material-prep.ts')
assertIncludes(materialPrepData, 'export interface TransferMaterialAvailableLot', '缺少中转可配置面料数据模型')
assertIncludes(materialPrepPage, '中转可配置面料', '仓库配料页缺少中转可配置面料区域')
assertIncludes(materialPrepPage, '配置面料 - 布料', '布料唯一动作缺失')
;[
  '配置面料 - 印花面料',
  '配置面料 - 染色面料',
  '配置面料 - 纯色面料',
  '配置面料 - 里布',
  '创建印花单',
  '创建染色单',
  '进入裁床仓',
  '入裁床仓',
  '入库',
  '上架',
].forEach((token) => {
  assert(!materialPrepPage.includes(token), `仓库配料页仍出现错误动作：${token}`)
  assert(!materialPrepData.includes(token), `中转可配置面料数据仍出现错误动作：${token}`)
})

const sampleWarehouseFiles = existingPaths([
  'src/pages/process-factory/cutting/sample-warehouse.ts',
  'src/pages/process-factory/cutting/sample-warehouse-model.ts',
])
assert(sampleWarehouseFiles.length > 0, '缺少裁床样衣仓轻量能力')

const permissionSource = read('src/data/fcs/action-permissions.ts')
assertIncludes(permissionSource, 'CONFIGURE_FABRIC_MATERIAL', '缺少布料配置动作权限')
assertIncludes(permissionSource, '无操作权限', '缺少无操作权限提示')
assertIncludes(permissionSource, 'CREATE_HANDOVER_RECORD', '缺少交出动作权限')
assertIncludes(permissionSource, 'RECEIVER_WRITEBACK', '缺少接收方回写动作权限')
assertIncludes(permissionSource, 'REVIEW_REPLENISHMENT', '缺少补料审核动作权限')

const noApiScopeSource = [
  materialPrepPage,
  read('src/pages/pda-handover-detail.ts'),
  read('src/pages/process-factory/cutting/replenishment.ts'),
  permissionSource,
].join('\n')
assertNoMatch(
  noApiScopeSource,
  /\baxios\b|(^|[^\w])fetch\(|\bcreateApi\b|\bapiClient\b|\/api\/|\bi18n\b|\buseTranslation\b|\blocale\b|\blocales\b|\btranslations\b|语言包|多语言/,
  '本轮范围内出现 API 或 i18n 改造',
)

const noWmsScopeSource = [materialPrepPage, materialPrepData, readIfExists('src/pages/process-factory/cutting/sample-warehouse.ts')].join('\n')
assertNoMatch(noWmsScopeSource, /库存三态|availableStock|occupiedStock|inTransitStock|库位上架|拣货波次|完整入库|WMS入库|locationRule/, '本轮范围内出现完整 WMS 越界')

console.log(
  JSON.stringify(
    {
      脚本可移植性: '通过',
      legacy检查稳定性: '通过',
      二维码展示: '通过',
      页面短文案: '通过',
      中转可配置面料: '通过',
      样衣仓轻量能力: '通过',
      前端动作权限: '通过',
    },
    null,
    2,
  ),
)
