#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getProcessDefinitionByCode,
  listActiveProcessCraftDefinitions,
} from '../src/data/fcs/process-craft-dict.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8')
}

function ensureExists(relativePath: string): void {
  assert(fs.existsSync(path.resolve(repoRoot, relativePath)), `缺少文件：${relativePath}`)
}

const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> }
const scripts = pkg.scripts || {}

const requiredCommands = [
  'check:production-craft-dict-page',
  'check:process-craft-sam-rules',
  'check:process-craft-final-taxonomy',
  'check:fcs-inactive-process-craft-usage',
  'check:factory-capacity-profile',
  'check:capacity-equipment-linkage',
  'check:capacity-calendar-ia',
  'check:capacity-risk-process-craft-source',
  'check:capacity-risk-and-bottleneck',
  'check:fcs-handover-domain',
  'check:pda-exec-task-detail',
  'check:pda-handover-pages',
  'check:pda-pickup-flow',
  'check:pda-task-receive-scope',
  'check:post-route-qc-recheck',
  'check:quality-deduction-domain',
  'check:quality-deduction-lifecycle',
  'check:quality-deduction-platform',
  'check:production-confirmation',
  'check:fcs-production-tech-pack-snapshot',
  'check:fcs-tech-pack-pattern-parser',
  'check:fcs-tech-pack-snapshot-consumption',
  'check:printing-workflow',
  'check:dyeing-workflow',
  'check:cutting-fei-ticket-assembly',
  'check:cutting-material-prep-pickup-replenishment',
  'check:cutting-marker-spreading-actions',
  'check:cutting-traceability-chain',
  'check:cutting-source-provenance',
  'check:cutting-writeback-integrity',
  'check:cutting-production-progress-columns',
  'check:cutting:all',
  'check:tech-pack-pattern-and-images',
  'check:fcs-progress-and-routes',
  'check:menu-routes',
  'check:fcs-end-to-end',
  'check:legacy-terminology-cleanup',
  'check:fcs-final-acceptance',
]

requiredCommands.forEach((command) => {
  assert(scripts[command], `package.json 缺少命令：${command}`)
})

const requiredFiles = [
  'src/data/fcs/process-craft-dict.ts',
  'src/data/fcs/factory-capacity-profile-mock.ts',
  'scripts/check-capacity-equipment-linkage.ts',
  'scripts/check-capacity-risk-process-craft-source.ts',
  'scripts/check-fcs-inactive-process-craft-usage.ts',
  'scripts/check-fcs-tech-pack-pattern-parser.ts',
  'src/data/fcs/task-qr.ts',
  'src/data/fcs/task-handover-domain.ts',
  'src/data/fcs/production-confirmation.ts',
  'src/data/fcs/printing-task-domain.ts',
  'src/data/fcs/dyeing-task-domain.ts',
  'src/data/fcs/production-tech-pack-snapshot-types.ts',
  'src/data/fcs/fcs-pattern-file-parser.ts',
  'src/data/fcs/cutting/generated-fei-tickets.ts',
  'src/data/fcs/cutting/material-prep.ts',
  'src/data/fcs/cutting/replenishment.ts',
  'src/pages/pda-exec-detail.ts',
  'src/pages/progress-handover.ts',
  'src/pages/process-factory/printing/statistics.ts',
  'src/pages/process-factory/dyeing/reports.ts',
  'src/pages/process-factory/cutting/fei-tickets.ts',
  'src/pages/process-factory/cutting/material-prep.ts',
  'src/pages/fcs-production-tech-pack-snapshot.ts',
  'src/pages/progress-board.ts',
  'src/data/app-shell-config.ts',
  'src/router/routes-fcs.ts',
  'src/router/route-renderers-fcs.ts',
  'scripts/check-menu-routes.mjs',
  'scripts/check-process-craft-final-taxonomy.ts',
  'scripts/check-fcs-final-acceptance.ts',
  'docs/fcs-truth-source-final-acceptance.md',
]

requiredFiles.forEach(ensureExists)

const activeCrafts = listActiveProcessCraftDefinitions()
assert(!activeCrafts.some((item) => item.processCode === 'WASHING'), '活跃工艺中不应存在 WASHING')
assert(!activeCrafts.some((item) => item.processCode === 'HARDWARE'), '活跃工艺中不应存在五金工序')
assert(!activeCrafts.some((item) => item.processCode === 'FROG_BUTTON'), '活跃工艺中不应存在盘扣工序')
assert(getProcessDefinitionByCode('SHRINKING')?.stageCode === 'PREP', '缩水必须归准备阶段')
assert(getProcessDefinitionByCode('POST_FINISHING')?.generatesExternalTask === true, '后道父任务必须生成任务')

const handoverSource =
  read('src/data/fcs/process-tasks.ts') +
  read('src/data/fcs/task-handover-domain.ts') +
  read('src/data/fcs/pda-handover-events.ts') +
  read('src/data/fcs/task-qr.ts')
;['taskQrValue', 'handoverOrderQrValue', 'handoverRecordQrValue', 'receiverWrittenQty', 'receiverWrittenAt', 'QuantityObjection', 'raisedByKind'].forEach((token) => {
  assert(handoverSource.includes(token), `交出链路缺少字段：${token}`)
})

const confirmationSource = read('src/pages/production/confirmation-print.ts') + read('src/data/fcs/production-confirmation.ts')
;['生产确认单', '暂无图片', 'window.print'].forEach((token) => {
  assert(confirmationSource.includes(token), `生产确认单缺少：${token}`)
})
const confirmationPageSource = read('src/pages/production/confirmation-print.ts')
;['jspdf', 'pdfmake', 'html2pdf', 'react-pdf', 'picsum', 'unsplash', 'dummyimage'].forEach((token) => {
  assert(!confirmationPageSource.includes(token), `生产确认单页面不应包含：${token}`)
})

const printingSource =
  read('src/pages/process-factory/printing/work-orders.ts') +
  read('src/pages/process-factory/printing/progress.ts') +
  read('src/pages/process-factory/printing/pending-review.ts') +
  read('src/pages/process-factory/printing/statistics.ts') +
  read('src/pages/process-factory/printing/dashboards.ts') +
  read('src/data/fcs/printing-task-domain.ts')
;['印花任务', '待送货', '中转区域', '打印机编号', '原料使用', '待审核'].forEach((token) => {
  assert(printingSource.includes(token), `印花口径缺少：${token}`)
})
;['印花 PDA', '印花PDA', 'Printing PDA'].forEach((token) => {
  assert(!printingSource.includes(token), `印花口径不应包含：${token}`)
})

const dyeingSource =
  read('src/pages/process-factory/dyeing/work-orders.ts') +
  read('src/pages/process-factory/dyeing/dye-orders.ts') +
  read('src/pages/process-factory/dyeing/reports.ts') +
  read('src/data/fcs/dyeing-task-domain.ts')
;['染色任务', '待送货', '中转区域', '染缸编号', '等待原因', '节点耗时', '待审核'].forEach((token) => {
  assert(dyeingSource.includes(token), `染色口径缺少：${token}`)
})
;['染色 PDA', '染色PDA', 'Dyeing PDA'].forEach((token) => {
  assert(!dyeingSource.includes(token), `染色口径不应包含：${token}`)
})

const cuttingSource =
  read('src/pages/process-factory/cutting/fei-tickets.ts') +
  read('src/pages/process-factory/cutting/fei-ticket-print-projection.ts') +
  read('src/pages/process-factory/cutting/material-prep.ts') +
  read('src/pages/process-factory/cutting/replenishment.ts') +
  read('src/pages/process-factory/cutting/cut-piece-warehouse.ts') +
  read('src/pages/process-factory/cutting/fabric-warehouse.ts') +
  read('src/data/fcs/cutting/generated-fei-tickets.ts') +
  read('src/data/fcs/cutting/material-prep.ts') +
  read('src/data/fcs/cutting/replenishment.ts')
;['fabricRollNo', 'fabricColor', 'sizeCode', 'partName', 'bundleQty', 'assemblyGroupKey', 'cutOrderQrValue', '补料建议', 'A区', 'B区', 'C区'].forEach((token) => {
  assert(cuttingSource.includes(token), `裁床口径缺少：${token}`)
})
;['库存三态', 'availableStock', 'occupiedStock', 'inTransitStock', '库位上架', '拣货波次', 'WMS入库'].forEach((token) => {
  assert(!cuttingSource.includes(token), `裁床口径不应包含：${token}`)
})

const techPackSource =
  read('src/data/fcs/production-tech-pack-snapshot-types.ts') +
  read('src/data/fcs/production-tech-pack-snapshot-builder.ts') +
  read('src/data/fcs/fcs-pattern-file-parser.ts') +
  read('src/pages/tech-pack/pattern-domain.ts') +
  read('src/pages/tech-pack/events.ts') +
  read('src/pages/fcs-production-tech-pack-snapshot.ts') +
  read('src/pages/production/confirmation-print.ts')
;['patternFiles', '纸样类型', '针织', '布料', '打版软件', '裁片部位', '暂无图片'].forEach((token) => {
  assert(techPackSource.includes(token), `技术包口径缺少：${token}`)
})
;['纸样文件类型', '布料纸样', '针织纸样', '纸样分类', '解析纸样'].forEach((token) => {
  assert(techPackSource.includes(token), `技术包解析迁移口径缺少：${token}`)
})

const progressSource =
  read('src/pages/progress-board.ts') +
  read('src/pages/progress-handover.ts') +
  read('src/pages/progress-material.ts') +
  read('src/pages/process-factory/printing/statistics.ts') +
  read('src/pages/process-factory/dyeing/reports.ts') +
  read('src/pages/process-factory/cutting/production-progress.ts') +
  read('src/pages/process-factory/cutting/cutting-summary.ts')
;['待交出', '待回写', '差异', '异议', '回货质检', '后道复检', '补料状态', '裁片仓状态'].forEach((token) => {
  assert(progressSource.includes(token), `进度口径缺少：${token}`)
})

const routeSource =
  read('src/data/app-shell-config.ts') +
  read('src/router/routes-fcs.ts') +
  read('src/router/route-renderers-fcs.ts') +
  read('src/router/routes.ts') +
  read('src/router/route-renderers.ts')
;[
  '/fcs/production/orders',
  '/fcs/progress/board',
  '/fcs/progress/handover',
  '/fcs/progress/material',
  '/fcs/craft/printing/statistics',
  '/fcs/craft/dyeing/reports',
  '/fcs/craft/cutting/production-progress',
  '/confirmation-print',
].forEach((token) => {
  assert(routeSource.includes(token), `路由注册缺少：${token}`)
})

const forbiddenUiTerms = [
  '去交接（待交出）',
  '交出头',
  '仓库自动回写',
  '印花 PDA',
  '染色 PDA',
  'PDA质检',
  'PDA裁床',
  'PDA领料',
  'PDA配料',
]
const uiSource =
  read('src/pages/progress-exceptions/detail-domain.ts') +
  read('src/pages/process-factory/cutting/marker-spreading.ts') +
  read('src/pages/process-factory/cutting/cut-piece-warehouse.ts') +
  read('src/pages/process-factory/cutting/transfer-bags.ts') +
  read('src/pages/progress-milestone-config.ts')
forbiddenUiTerms.forEach((token) => {
  assert(!uiSource.includes(token), `页面仍存在禁止文案：${token}`)
})

execSync('npm run check:menu-routes', {
  cwd: repoRoot,
  stdio: 'pipe',
  encoding: 'utf8',
})

console.log(
  JSON.stringify(
    {
      核心检查命令数: requiredCommands.length,
      核心文件数: requiredFiles.length,
      最终验收: '通过',
    },
    null,
    2,
  ),
)
