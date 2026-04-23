#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getRemovedLegacyTermPattern,
  getRemovedPseudoCraftPattern,
} from './utils/special-craft-banlist.ts'

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

function joinText(parts: string[]): string {
  return parts.join('')
}

function buildToken(...parts: string[]): string {
  return parts.join('')
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
const capacityPageSource = read('src/pages/capacity.ts')
const capacityDataSource = read('src/data/fcs/capacity-calendar.ts')
const processCraftDictSource = read('src/data/fcs/process-craft-dict.ts')

for (const file of [...scriptFiles, 'package.json']) {
  const source = file === 'package.json' ? packageSource : read(file)
  assertNoMatch(source, hardcodedPathPattern, `${file} 仍包含硬编码本地路径`)
}

assertIncludes(packageSource, 'check:capacity-risk-process-craft-source', 'package.json 缺少任务工时风险工序工艺来源检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-capacity-risk-process-craft-source.ts')), '缺少任务工时风险工序工艺来源检查脚本')
assertIncludes(packageSource, 'check:factory-internal-warehouse-model', 'package.json 缺少工厂内部仓模型检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-factory-internal-warehouse-model.ts')), '缺少工厂内部仓模型检查脚本')
assertIncludes(packageSource, 'check:factory-mobile-app-redesign', 'package.json 缺少工厂端移动应用改造检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-factory-mobile-app-redesign.ts')), '缺少工厂端移动应用改造检查脚本')
assertIncludes(packageSource, 'check:factory-handover-warehouse-linkage', 'package.json 缺少交接与仓管联动检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-factory-handover-warehouse-linkage.ts')), '缺少交接与仓管联动检查脚本')
assertIncludes(packageSource, 'check:special-craft-operation-menus', 'package.json 缺少特殊工艺一级菜单检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-special-craft-operation-menus.ts')), '缺少特殊工艺一级菜单检查脚本')
assertIncludes(packageSource, 'check:special-craft-task-generation', 'package.json 缺少生产单特殊工艺任务生成检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-special-craft-task-generation.ts')), '缺少生产单特殊工艺任务生成检查脚本')
assertIncludes(packageSource, 'check:cutting-special-craft-dispatch-return', 'package.json 缺少裁床特殊工艺发料与回仓检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-cutting-special-craft-dispatch-return.ts')), '缺少裁床特殊工艺发料与回仓检查脚本')
assertIncludes(packageSource, 'check:cutting-sewing-dispatch', 'package.json 缺少裁片发料检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-cutting-sewing-dispatch.ts')), '缺少裁片发料检查脚本')
assertIncludes(packageSource, 'check:progress-statistics-linkage', 'package.json 缺少统计与进度联动检查命令')
assertIncludes(packageSource, 'check:transfer-bag-mobile-closed-loop', 'package.json 缺少中转袋移动端闭环检查命令')
assertIncludes(packageSource, 'check:menu-visibility-test-factory-and-default-views', 'package.json 缺少菜单可见性、测试工厂与默认展示收边检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-progress-statistics-linkage.ts')), '缺少统计与进度联动检查脚本')
assert(fs.existsSync(resolveRepoPath('scripts/check-menu-visibility-test-factory-and-default-views.ts')), '缺少菜单可见性、测试工厂与默认展示收边检查脚本')
assertIncludes(packageSource, 'check:special-craft-task-and-fei-flow-deepening', 'package.json 缺少特殊工艺任务与菲票流转深化检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-special-craft-task-and-fei-flow-deepening.ts')), '缺少特殊工艺任务与菲票流转深化检查脚本')
assertIncludes(packageSource, 'check:fcs-inactive-process-craft-usage', 'package.json 缺少停用工序工艺核查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-fcs-inactive-process-craft-usage.ts')), '缺少停用工序工艺核查脚本')
assertIncludes(packageSource, 'check:fcs-tech-pack-special-craft-source-and-dialog-stability', 'package.json 缺少技术包特殊工艺来源与弹窗稳定性检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-fcs-tech-pack-special-craft-source-and-dialog-stability.ts')), '缺少技术包特殊工艺来源与弹窗稳定性检查脚本')
assertIncludes(packageSource, 'check:tech-pack-special-craft-target-object-and-versioning', 'package.json 缺少特殊工艺作用对象与技术包版本检查命令')
assert(fs.existsSync(resolveRepoPath('scripts/check-tech-pack-special-craft-target-object-and-versioning.ts')), '缺少特殊工艺作用对象与技术包版本检查脚本')
assertIncludes(capacityDataSource, 'getActiveProcessOptions()', '任务工时风险数据层未改为工序工艺字典 helper')
assertIncludes(capacityDataSource, 'getActiveCraftOptionsByProcess()', '任务工时风险工艺筛选未改为工序工艺字典 helper')
assertIncludes(capacityDataSource, 'assertProcessCraftExists(', '任务工时风险数据层未校验工序工艺字典')
assertNoMatch(capacityPageSource, /裁片 - 定位裁/, '任务工时风险页仍残留固定工序工艺样例')
assertNoMatch(capacityPageSource, getRemovedPseudoCraftPattern(), '任务工时风险页仍残留已删除伪特殊工艺')
assertNoMatch(processCraftDictSource, getRemovedPseudoCraftPattern(), '工序工艺字典源码仍残留已删除伪特殊工艺')

const techPackSource = read('src/data/fcs/tech-packs.ts')
const routingTemplateSource = read('src/data/fcs/routing-templates.ts')
const techPackContextSource = read('src/pages/tech-pack/context.ts')
assertNoMatch(techPackSource, getRemovedLegacyTermPattern(), 'FCS 技术包演示数据仍残留已删除旧项')
assertNoMatch(routingTemplateSource, getRemovedLegacyTermPattern(), 'FCS 工艺路线模板仍残留已删除旧项')
assertNoMatch(techPackContextSource, /listAllProcessCraftDefinitions\(\)\.find\(\(craftItem\) => craftItem\.craftName === item\.name\)/, '技术包页面仍回填历史停用工艺')
assertIncludes(techPackContextSource, 'getPatternPieceSpecialCraftOptionsFromCurrentTechPack', '技术包页面缺少基于当前技术包的特殊工艺 helper')
assertIncludes(techPackContextSource, "selectedTargetObject !== '已裁部位'", '纸样特殊工艺来源必须限制为技术包已维护的已裁部位特殊工艺')
assertIncludes(techPackSource, 'supportedTargetObjects', '技术包数据缺少特殊工艺多选作用对象')
assertIncludes(techPackSource, 'bundleLengthCm', '技术包数据缺少捆条长度字段')
assertIncludes(techPackSource, 'bundleWidthCm', '技术包数据缺少捆条宽度字段')
assertIncludes(techPackSource, '当前有草稿版本的技术包', '技术包草稿唯一提示缺失')
assertNoMatch(techPackContextSource, getRemovedPseudoCraftPattern(), '技术包上下文仍残留已删除伪特殊工艺')

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
const noApiI18nPattern = new RegExp(
  [
    String.raw`\b${buildToken('axi', 'os')}\b`,
    String.raw`(^|[^\w])${buildToken('fet', 'ch\\(')}`,
    String.raw`\b${buildToken('create', 'Api')}\b`,
    String.raw`\b${buildToken('api', 'Client')}\b`,
    escapeRegExp(buildToken('/', 'api', '/')),
    String.raw`\b${buildToken('i1', '8n')}\b`,
    String.raw`\b${buildToken('use', 'Translation')}\b`,
    String.raw`\b${buildToken('loc', 'ale')}\b`,
    String.raw`\b${buildToken('loc', 'ales')}\b`,
    String.raw`\b${buildToken('trans', 'lations')}\b`,
    joinText(['语言', '包']),
    joinText(['多', '语言']),
  ].join('|'),
)
assertNoMatch(
  noApiScopeSource,
  noApiI18nPattern,
  '本轮范围内出现 API 或多语言改造',
)

const noWmsScopeSource = [materialPrepPage, materialPrepData, readIfExists('src/pages/process-factory/cutting/sample-warehouse.ts')].join('\n')
const noWmsScopePattern = new RegExp(
  [
    joinText(['库存', '三态']),
    buildToken('available', 'Stock'),
    buildToken('occupied', 'Stock'),
    buildToken('inTransit', 'Stock'),
    joinText(['库位', '上架']),
    joinText(['拣货', '波次']),
    joinText(['完整', '入库']),
    joinText(['WMS', '入库']),
    buildToken('location', 'Rule'),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
assertNoMatch(noWmsScopeSource, noWmsScopePattern, '本轮范围内出现完整 WMS 越界')

const factoryWarehouseSource = [
  read('src/data/fcs/factory-internal-warehouse.ts'),
  read('src/data/fcs/factory-warehouse-linkage.ts'),
  read('src/pages/factory-internal-warehouse.ts'),
].join('\n')
const specialCraftSource = [
  read('src/data/fcs/special-craft-operations.ts'),
  read('src/data/fcs/special-craft-task-orders.ts'),
  read('src/data/fcs/cutting/special-craft-fei-ticket-flow.ts'),
  read('src/data/fcs/cutting/sewing-dispatch.ts'),
  read('src/pages/process-factory/special-craft/task-orders.ts'),
  read('src/pages/process-factory/special-craft/task-detail.ts'),
  read('src/pages/process-factory/special-craft/warehouse.ts'),
  read('src/pages/process-factory/special-craft/statistics.ts'),
  read('src/pages/process-factory/cutting/special-processes.ts'),
  read('src/data/app-shell-config.ts'),
  read('src/router/routes-fcs.ts'),
  read('src/router/route-renderers-fcs.ts'),
].join('\n')
assertNoMatch(specialCraftSource, /specialCraftFlowStatus:\s*['"]VOIDED['"]|特殊工艺报废.*作废|特殊工艺货损.*作废/, '特殊工艺报废 / 货损不得做成菲票作废')
assertNoMatch(specialCraftSource, /子菲票|拆菲票|splitFeiTicket/, '本轮不得新增子菲票或拆菲票')
assertIncludes(specialCraftSource, '差异待处理不阻断裁片统一发料', '特殊工艺差异待处理不得直接阻断实际业务推进')
const factoryMobileSource = [
  read('src/pages/pda-shell.ts'),
  read('src/pages/pda-notify.ts'),
  read('src/pages/pda-notify-detail.ts'),
  read('src/pages/pda-handover.ts'),
  read('src/pages/pda-handover-detail.ts'),
  read('src/pages/pda-warehouse.ts'),
  read('src/pages/pda-warehouse-wait-process.ts'),
  read('src/pages/pda-warehouse-wait-handover.ts'),
  read('src/pages/pda-warehouse-inbound-records.ts'),
  read('src/pages/pda-warehouse-outbound-records.ts'),
  read('src/pages/pda-warehouse-stocktake.ts'),
  read('src/data/fcs/factory-mobile-todos.ts'),
  read('src/data/fcs/factory-mobile-warehouse.ts'),
].join('\n')
const factoryWarehouseMobileSource = [
  read('src/pages/pda-warehouse.ts'),
  read('src/pages/pda-warehouse-wait-process.ts'),
  read('src/pages/pda-warehouse-wait-handover.ts'),
  read('src/pages/pda-warehouse-inbound-records.ts'),
  read('src/pages/pda-warehouse-outbound-records.ts'),
  read('src/pages/pda-warehouse-stocktake.ts'),
  read('src/data/fcs/factory-mobile-warehouse.ts'),
].join('\n')
const cuttingSpecialCraftPageSource = [
  read('src/pages/process-factory/cutting/special-craft-dispatch.ts'),
  read('src/pages/process-factory/cutting/special-craft-return.ts'),
  read('src/pages/process-factory/cutting/fei-tickets.ts'),
  read('src/pages/process-factory/cutting/production-progress.ts'),
  read('src/pages/process-factory/cutting/cutting-summary.ts'),
  read('src/pages/process-factory/special-craft/task-detail.ts'),
  read('src/pages/process-factory/special-craft/warehouse.ts'),
].join('\n')
const cuttingSpecialCraftFlowSource = [
  read('src/data/fcs/cutting/special-craft-fei-ticket-flow.ts'),
  cuttingSpecialCraftPageSource,
].join('\n')
const cuttingSewingDispatchSource = [
  read('src/data/fcs/cutting/sewing-dispatch.ts'),
  read('src/pages/process-factory/cutting/sewing-dispatch.ts'),
  read('src/pages/process-factory/cutting/transfer-bags.ts'),
  read('src/pages/process-factory/cutting/fei-tickets.ts'),
  read('src/pages/process-factory/cutting/production-progress.ts'),
  read('src/pages/process-factory/cutting/cutting-summary.ts'),
  read('src/pages/production/detail-domain.ts'),
  read('src/pages/pda-handover.ts'),
  read('src/pages/pda-handover-detail.ts'),
].join('\n')
const progressStatisticsSource = [
  read('src/data/fcs/progress-statistics-linkage.ts'),
  read('src/pages/progress-board/core.ts'),
  read('src/pages/production/detail-domain.ts'),
  read('src/pages/process-factory/cutting/production-progress.ts'),
  read('src/pages/process-factory/cutting/cutting-summary.ts'),
  read('src/pages/process-factory/special-craft/statistics.ts'),
  read('src/pages/factory-internal-warehouse.ts'),
  read('src/pages/pda-warehouse-shared.ts'),
].join('\n')
const menuVisibilitySource = [
  read('src/data/app-shell-config.ts'),
  read('src/data/fcs/special-craft-operations.ts'),
  read('src/data/fcs/factory-master-store.ts'),
  read('src/data/fcs/factory-mock-data.ts'),
  read('src/data/fcs/capacity-calendar.ts'),
  read('src/pages/process-factory/special-craft/shared.ts'),
  read('src/pages/factory-profile.ts'),
  read('src/pages/factory-capacity-profile.ts'),
].join('\n')
const legacyWarehouseCopyPattern = new RegExp(
  [joinText(['来', '料仓']), joinText(['半成品', '仓'])].map((token) => escapeRegExp(token)).join('|'),
)
const buildLegacyMobileCopy = (...parts: string[]): string => parts.join('')
const visiblePdaCopyPattern = new RegExp(
  [
    `>[^<]*${buildLegacyMobileCopy('PD', 'A')}`,
    buildLegacyMobileCopy('PDA', '执行'),
    buildLegacyMobileCopy('PDA', '交接'),
    buildLegacyMobileCopy('PDA', '仓管'),
    buildLegacyMobileCopy('PDA', '待办'),
    buildLegacyMobileCopy('PDA', '扫码'),
    buildLegacyMobileCopy('PDA', '质检'),
  ]
    .join('|'),
)
const mobileWarehouseNoWmsPattern = new RegExp(
  [
    joinText(['库存', '三态']),
    joinText(['可用', '库存']),
    joinText(['占用', '库存']),
    joinText(['在途', '库存']),
    ['available', 'Stock'].join(''),
    ['occupied', 'Stock'].join(''),
    ['inTransit', 'Stock'].join(''),
    joinText(['上架', '任务']),
    joinText(['拣货', '波次']),
    joinText(['拣货', '路径']),
    joinText(['库位', '规则']),
    joinText(['完整', '库存账']),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const mobileWarehouseNoManualFlowPattern = new RegExp(
  [
    joinText(['确认', '领料']),
    joinText(['手动', '入库']),
    joinText(['手动', '出库']),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const chartLibraryPattern = new RegExp(
  [buildToken('e', 'charts'), buildToken('chart', '.', 'js'), buildToken('re', 'charts')]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const autoSchedulePattern = new RegExp(
  [
    joinText(['自动', '排程']),
    joinText(['AI', '排程']),
    joinText(['智能', '调度']),
    joinText(['自动', '派单']),
    joinText(['自动', '改派']),
    buildToken('auto', 'Schedule'),
    buildToken('smart', 'Schedule'),
    buildToken('schedule', 'Suggestion'),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const apiI18nChartSchedulePattern = new RegExp(
  [
    buildToken('axi', 'os'),
    String.raw`(^|[^\w])${buildToken('fet', 'ch\\(')}`,
    buildToken('api', 'Client'),
    escapeRegExp(buildToken('/', 'api', '/')),
    buildToken('i1', '8n'),
    buildToken('use', 'Translation'),
    buildToken('loc', 'ales'),
    buildToken('trans', 'lations'),
    buildToken('e', 'charts'),
    buildToken('chart', '\\.', 'js'),
    buildToken('re', 'charts'),
    joinText(['AI', '排程']),
    joinText(['自动', '排程']),
  ].join('|'),
)
const specialCraftNoManualTaskPattern = new RegExp(
  [
    joinText(['新增', '任务']),
    joinText(['生', '成任务']),
    joinText(['从', '裁片仓', '生成']),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const specialCraftNoManualWarehousePattern = new RegExp(
  [
    joinText(['手动', '入库']),
    joinText(['手动', '出库']),
    joinText(['新增', '库存']),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const specialCraftNoEarlyFeiPattern = new RegExp(
  [
    ['bind', 'Fei'].join(''),
    joinText(['手动', '绑定', '菲票']),
    joinText(['新增', '绑定', '菲票']),
    joinText(['绑定', '菲票', '按钮']),
    joinText(['生', '成菲票']),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const cuttingSpecialCraftDirectShipPattern = new RegExp(
  [
    joinText(['直接发', '车', '缝']),
    joinText(['直发', '车缝']),
    joinText(['直接发', '成衣', '仓']),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const cuttingSpecialCraftNoMainModelPattern = new RegExp(
  [
    'CuttingSpecialCraftDispatchOrder',
    'CuttingSpecialCraftReturnOrder',
    joinText(['特殊工艺', '发料单']),
    joinText(['特殊工艺', '回仓单']),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const cuttingSpecialCraftNoTaskGenerationPattern = new RegExp(
  [
    joinText(['从', '裁片仓', '生成']),
    joinText(['裁片', '入仓', '后生成']),
    'generateSpecialCraftTask',
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const cuttingSewingNoDirectShipPattern = new RegExp(
  [
    joinText(['特殊工艺', '厂', '直接发', '车', '缝']),
    joinText(['直接发', '车', '缝']),
    joinText(['直接发', '成衣', '仓']),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const cuttingSewingNoIncompleteDispatchPattern = new RegExp(
  [
    joinText(['强制', '通过']),
    joinText(['忽略', '校验']),
    joinText(['未配齐', '提交交出']),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const cuttingSewingNoSecondHandoverPattern = new RegExp(
  [
    buildToken('Warehouse', 'HandoverOrder'),
    buildToken('Factory', 'OutboundOrder'),
    joinText(['仓库', '交出单']),
    joinText(['新', '交出框架']),
    buildToken('Cutting', 'Sewing', 'HandoverOrder'),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
const cuttingSewingNoSewingWarehousePattern = new RegExp(
  [
    joinText(['车', '缝厂', '待加工仓']),
    joinText(['车', '缝厂', '待交出仓']),
    ['sew', 'ing', 'WAIT_PROCESS'].join('.*'),
    ['sew', 'ing', 'WAIT_HANDOVER'].join('.*'),
  ].join('|'),
)
assertIncludes(factoryWarehouseSource, '待加工仓', '工厂内部仓缺少待加工仓口径')
assertIncludes(factoryWarehouseSource, '待交出仓', '工厂内部仓缺少待交出仓口径')
assertIncludes(factoryWarehouseSource, '创建全盘', '工厂内部仓缺少全盘入口')
assertNoMatch(factoryWarehouseSource, mobileWarehouseNoWmsPattern, '工厂内部仓出现 WMS 越界')
assertNoMatch(factoryWarehouseSource, legacyWarehouseCopyPattern, '工厂内部仓仍保留旧仓库称呼')
assertIncludes(factoryMobileSource, "label: '接单'", '工厂端移动应用缺少接单 Tab')
assertIncludes(factoryMobileSource, "label: '执行'", '工厂端移动应用缺少执行 Tab')
assertIncludes(factoryMobileSource, "label: '交接'", '工厂端移动应用缺少交接 Tab')
assertIncludes(factoryMobileSource, "label: '仓管'", '工厂端移动应用缺少仓管 Tab')
assertIncludes(factoryMobileSource, "label: '结算'", '工厂端移动应用缺少结算 Tab')
assertNoMatch(factoryMobileSource, /label:\s*'待办'/, '工厂端移动应用底部 Tab 仍保留待办')
assertIncludes(factoryMobileSource, '当前待办', '工厂端移动应用缺少当前待办弹窗')
assertIncludes(factoryMobileSource, '待办汇总', '工厂端移动应用缺少待办汇总页')
assertIncludes(factoryMobileSource, '待办详情', '工厂端移动应用缺少待办详情页')
assertIncludes(factoryMobileSource, '待加工仓', '工厂端仓管缺少待加工仓')
assertIncludes(factoryMobileSource, '待交出仓', '工厂端仓管缺少待交出仓')
assertIncludes(factoryMobileSource, '入库记录', '工厂端仓管缺少入库记录')
assertIncludes(factoryMobileSource, '出库记录', '工厂端仓管缺少出库记录')
assertIncludes(factoryMobileSource, '盘点', '工厂端仓管缺少盘点')
assertNoMatch(factoryMobileSource, new RegExp([joinText(['领料', '头']), joinText(['交出', '头'])].map((token) => escapeRegExp(token)).join('|')), '交接页面仍残留旧头单口径')
assertIncludes(factoryMobileSource, '完成领料单', '交接页面缺少完成领料单')
assertIncludes(factoryMobileSource, '完成交出单', '交接页面缺少完成交出单')
assertNoMatch(factoryMobileSource, visiblePdaCopyPattern, '工厂端移动应用仍残留 PDA 用户可见文案')
assertNoMatch(factoryMobileSource, mobileWarehouseNoWmsPattern, '工厂端仓管出现 WMS 越界口径')
assertNoMatch(factoryMobileSource, legacyWarehouseCopyPattern, '工厂端仓管仍保留旧仓库称呼')
assertIncludes(factoryWarehouseSource, 'linkPickupConfirmToInboundRecord', '交接与仓管联动适配层缺少待领料到入库联动')
assertIncludes(factoryWarehouseSource, 'linkHandoverRecordToOutboundRecord', '交接与仓管联动适配层缺少交出到出库联动')
assertNoMatch(factoryWarehouseMobileSource, mobileWarehouseNoManualFlowPattern, '工厂端仓管不应承接手动交接主流程')
const duplicateWarehouseMainModelPattern = new RegExp(
  [
    buildToken('仓库', '领料单'),
    buildToken('仓库', '交出单'),
    buildToken('Factory', 'PickupOrder'),
    buildToken('Warehouse', 'PickupOrder'),
    buildToken('Factory', 'OutboundOrder'),
  ]
    .map((token) => escapeRegExp(token))
    .join('|'),
)
assertNoMatch(factoryWarehouseSource, duplicateWarehouseMainModelPattern, '源码仍残留重复仓库领料/交出主模型')
assertIncludes(specialCraftSource, 'special-craft', '缺少特殊工艺一级菜单与页面接入')
assertIncludes(specialCraftSource, '任务单', '特殊工艺页面缺少任务单口径')
assertIncludes(specialCraftSource, '仓库管理', '特殊工艺页面缺少仓库管理口径')
assertIncludes(specialCraftSource, '统计', '特殊工艺页面缺少统计口径')
assertNoMatch(specialCraftSource, specialCraftNoManualTaskPattern, '特殊工艺页面不应提供任务生成主流程')
assertNoMatch(specialCraftSource, specialCraftNoManualWarehousePattern, '特殊工艺页面不应提供手工仓库主流程')
assertNoMatch(specialCraftSource, specialCraftNoEarlyFeiPattern, `特殊工艺页面不应提前${buildToken('绑定', '菲票')}`)
assertNoMatch(specialCraftSource, mobileWarehouseNoWmsPattern, '特殊工艺页面不应扩展为完整 WMS')
assertNoMatch(specialCraftSource, apiI18nChartSchedulePattern, '特殊工艺页面不应越界到 API、多语言、图表库或排程能力')
assertNoMatch(specialCraftSource, /PDA|来料仓|半成品仓/, '特殊工艺页面不应保留旧文案')
assertNoMatch(cuttingSpecialCraftFlowSource, cuttingSpecialCraftDirectShipPattern, '裁床特殊工艺发料与回仓不应允许越过裁床统一发料')
assertNoMatch(cuttingSpecialCraftFlowSource, cuttingSpecialCraftNoMainModelPattern, '裁床特殊工艺发料与回仓不应新增主模型')
assertNoMatch(cuttingSpecialCraftFlowSource, cuttingSpecialCraftNoTaskGenerationPattern, '裁床特殊工艺发料与回仓不应重新生成特殊工艺任务')
assertNoMatch(cuttingSpecialCraftPageSource, /QR payload|FCS:|qrPayload|handoverRecordQrValue|feiTicketQrValue|JSON\.stringify/, '裁床特殊工艺页面不应直显二维码 payload 或 JSON')
assertIncludes(cuttingSewingDispatchSource, 'CuttingSewingDispatchOrder', '裁片发料缺少发料单模型')
assertIncludes(cuttingSewingDispatchSource, 'CuttingSewingDispatchBatch', '裁片发料缺少本次发料批次模型')
assertIncludes(cuttingSewingDispatchSource, 'CuttingSewingTransferBag', '裁片发料缺少中转袋模型')
assertIncludes(cuttingSewingDispatchSource, 'validateTransferBagCompleteness', '裁片发料缺少中转袋齐套校验')
assertIncludes(cuttingSewingDispatchSource, 'validateDispatchBatchCompleteness', '裁片发料缺少本次发料齐套校验')
assertIncludes(cuttingSewingDispatchSource, 'submitCuttingSewingDispatchBatch', '裁片发料缺少提交交出逻辑')
assertIncludes(cuttingSewingDispatchSource, 'syncSewingReceiveWritebackToDispatch', '裁片发料缺少车缝厂回写同步')
assertNoMatch(cuttingSewingDispatchSource, cuttingSewingNoDirectShipPattern, '裁片发料不应允许越过裁床统一发料')
assertNoMatch(cuttingSewingDispatchSource, cuttingSewingNoIncompleteDispatchPattern, '裁片发料不应允许未配齐交出')
assertNoMatch(cuttingSewingDispatchSource, cuttingSewingNoSecondHandoverPattern, '裁片发料不应新增第二套交出框架')
assertNoMatch(cuttingSewingDispatchSource, cuttingSewingNoSewingWarehousePattern, '裁片发料不应给车缝厂生成内部仓')
assertNoMatch(cuttingSewingDispatchSource, /QR payload|FCS:|JSON\.stringify/, '裁片发料页面不应直显二维码原始内容')
assertIncludes(progressStatisticsSource, 'progress-statistics-linkage', '统计与进度联动缺少统一聚合文件')
assertIncludes(progressStatisticsSource, 'buildProductionProgressSnapshot', '统计与进度联动缺少生产进度聚合')
assertIncludes(progressStatisticsSource, 'buildSewingDispatchProgressSnapshot', '统计与进度联动缺少裁片发料进度聚合')
assertIncludes(progressStatisticsSource, '统计结果只作为只读投影，不作为状态源头', '统计结果不得成为状态源头')
assertIncludes(progressStatisticsSource, '特殊工艺未回仓', '统计联动必须保留特殊工艺未回仓阻塞')
assertIncludes(progressStatisticsSource, 'includeTestFactories', '统计联动缺少测试工厂排除开关')
assertIncludes(progressStatisticsSource, 'sortProductionProgressByDefaultDueDate', '统计联动缺少默认交期排序 helper')
assertNoMatch(progressStatisticsSource, /未知原因|系统异常|其他原因/, '统计联动阻塞原因不应使用不可解释口径')
assertNoMatch(progressStatisticsSource, autoSchedulePattern, '统计联动不应新增排程或派单')
assertNoMatch(progressStatisticsSource, chartLibraryPattern, '统计联动不应新增图表库')
assertNoMatch(progressStatisticsSource, noApiI18nPattern, '统计联动不应新增 API 或多语言')
assertNoMatch(progressStatisticsSource, mobileWarehouseNoWmsPattern, '统计联动不应扩展完整 WMS')
assertIncludes(menuVisibilitySource, 'buildSpecialCraftMenuGroups()', 'PFOS 全局特殊工艺菜单 helper 缺失')
assertIncludes(menuVisibilitySource, 'buildSpecialCraftMenuGroupsForFactory', '工厂上下文特殊工艺菜单 helper 缺失')
assertIncludes(menuVisibilitySource, 'canFactorySeeSpecialCraftOperation', '特殊工艺菜单可见性 helper 缺失')
assertIncludes(menuVisibilitySource, 'ID-F090', '缺少全能力测试工厂固定 ID')
assertIncludes(menuVisibilitySource, 'isTestFactory', '测试工厂缺少 isTestFactory 标识')
assertIncludes(menuVisibilitySource, '测试工厂', '测试工厂页面标签缺失')
assertIncludes(menuVisibilitySource, 'listBusinessFactoryMasterRecords', '默认业务工厂过滤 helper 缺失')
assertNoMatch(menuVisibilitySource, /specialCraft(Menu|Operation).*(Acl|Permission)|factorySpecialCraftAcl|specialCraftRoleGuard/, '不得新增第二套菜单权限系统')
assertNoMatch(menuVisibilitySource, /const specialCraftMenuGroups: MenuGroup\[] = buildSpecialCraftMenuGroupsForFactory/, '不得把 PFOS 全局特殊工艺菜单误改为工厂过滤版本')

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
      工厂端移动应用: '通过',
      交接仓管联动: '通过',
      特殊工艺一级菜单: '通过',
      裁床特殊工艺发料回仓: '通过',
      裁片统一发车缝: '通过',
      菜单可见性与测试工厂: '通过',
    },
    null,
    2,
  ),
)
