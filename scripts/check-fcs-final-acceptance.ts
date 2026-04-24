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
import { listSpecialCraftOperationDefinitions } from '../src/data/fcs/special-craft-operations.ts'
import {
  assertNoRemovedLegacyTerm,
  removedLegacyCraftNames,
  removedLegacyProcessCodes,
} from './utils/special-craft-banlist.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8')
}

function ensureExists(relativePath: string): void {
  assert(fs.existsSync(path.resolve(repoRoot, relativePath)), `缺少文件：${relativePath}`)
}

function joinText(parts: string[]): string {
  return parts.join('')
}

const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> }
const scripts = pkg.scripts || {}

const requiredCommands = [
  'check:special-craft-business-taxonomy',
  'check:special-craft-operation-menus',
  'check:special-craft-task-generation',
  'check:factory-internal-warehouse-model',
  'check:factory-mobile-app-redesign',
  'check:mobile-execution-writeback',
  'check:process-warehouse-unification',
  'check:handover-writeback-difference-unification',
  'check:statistics-dashboard-real-data',
  'check:factory-handover-warehouse-linkage',
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
  'check:task-print-cards-foundation',
  'check:pfos-task-print-entry-spread',
  'check:process-factory-warehouse-menu-consolidation',
  'check:cutting-warehouse-management-switch',
  'check:task-card-entry-and-route-closure',
  'check:process-work-order-unification',
  'check:process-factory-tabs-and-post-finishing',
  'check:fcs-production-tech-pack-snapshot',
  'check:fcs-tech-pack-pattern-parser',
  'check:fcs-tech-pack-pattern-piece-detail',
  'check:fcs-tech-pack-special-craft-source-and-dialog-stability',
  'check:fcs-tech-pack-snapshot-consumption',
  'check:tech-pack-special-craft-target-object-and-versioning',
  'check:printing-workflow',
  'check:dyeing-workflow',
  'check:cutting-fei-ticket-assembly',
  'check:cutting-special-craft-dispatch-return',
  'check:cutting-sewing-dispatch',
  'check:progress-statistics-linkage',
  'check:special-craft-task-and-fei-flow-deepening',
  'check:pickup-handout-order-and-warehouse-foundation',
  'check:transfer-bag-mobile-closed-loop',
  'check:menu-visibility-test-factory-and-default-views',
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
  'src/data/fcs/process-work-order-domain.ts',
  'src/data/fcs/process-execution-writeback.ts',
  'src/data/fcs/process-warehouse-domain.ts',
  'src/data/fcs/process-statistics-domain.ts',
  'src/data/fcs/post-finishing-domain.ts',
  'src/data/fcs/special-craft-operations.ts',
  'src/data/fcs/special-craft-task-orders.ts',
  'src/data/fcs/special-craft-task-generation.ts',
  'src/data/fcs/factory-internal-warehouse.ts',
  'src/data/fcs/factory-mobile-todos.ts',
  'src/data/fcs/factory-mobile-warehouse.ts',
  'src/data/fcs/factory-warehouse-linkage.ts',
  'src/data/fcs/factory-capacity-profile-mock.ts',
  'src/data/fcs/factory-master-store.ts',
  'scripts/check-special-craft-business-taxonomy.ts',
  'scripts/check-special-craft-operation-menus.ts',
  'scripts/check-special-craft-task-generation.ts',
  'scripts/check-process-work-order-unification.ts',
  'scripts/check-process-factory-tabs-and-post-finishing.ts',
  'scripts/check-factory-internal-warehouse-model.ts',
  'scripts/check-factory-mobile-app-redesign.ts',
  'scripts/check-mobile-execution-writeback.ts',
  'scripts/check-process-warehouse-unification.ts',
  'scripts/check-handover-writeback-difference-unification.ts',
  'scripts/check-statistics-dashboard-real-data.ts',
  'scripts/check-factory-handover-warehouse-linkage.ts',
  'scripts/check-capacity-equipment-linkage.ts',
  'scripts/check-capacity-risk-process-craft-source.ts',
  'scripts/check-fcs-inactive-process-craft-usage.ts',
  'scripts/check-fcs-tech-pack-pattern-parser.ts',
  'scripts/check-fcs-tech-pack-pattern-piece-detail.ts',
  'scripts/check-fcs-tech-pack-special-craft-source-and-dialog-stability.ts',
  'scripts/check-tech-pack-special-craft-target-object-and-versioning.ts',
  'src/data/fcs/task-qr.ts',
  'src/data/fcs/task-handover-domain.ts',
  'src/data/fcs/task-print-cards.ts',
  'src/data/fcs/cutting-task-print-source.ts',
  'src/data/fcs/production-confirmation.ts',
  'src/data/fcs/printing-task-domain.ts',
  'src/data/fcs/printing-warehouse-view.ts',
  'src/data/fcs/dyeing-task-domain.ts',
  'src/data/fcs/dyeing-warehouse-view.ts',
  'src/data/fcs/production-tech-pack-snapshot-types.ts',
  'src/data/fcs/fcs-pattern-file-parser.ts',
  'src/data/fcs/cutting/generated-fei-tickets.ts',
  'src/data/fcs/cutting/special-craft-fei-ticket-flow.ts',
  'src/data/fcs/cutting/sewing-dispatch.ts',
  'src/data/fcs/progress-statistics-linkage.ts',
  'src/data/fcs/cutting/material-prep.ts',
  'src/data/fcs/cutting/replenishment.ts',
  'src/pages/pda-exec-detail.ts',
  'src/pages/pda-shell.ts',
  'src/pages/pda-notify.ts',
  'src/pages/pda-notify-detail.ts',
  'src/pages/pda-warehouse.ts',
  'src/pages/pda-warehouse-wait-process.ts',
  'src/pages/pda-warehouse-wait-handover.ts',
  'src/pages/pda-warehouse-inbound-records.ts',
  'src/pages/pda-warehouse-outbound-records.ts',
  'src/pages/pda-warehouse-stocktake.ts',
  'src/pages/progress-handover.ts',
  'src/pages/print/task-route-card.ts',
  'src/pages/print/task-delivery-card.ts',
  'src/pages/factory-internal-warehouse.ts',
  'src/pages/factory-profile.ts',
  'src/pages/factory-capacity-profile.ts',
  'src/pages/process-factory/special-craft/shared.ts',
  'src/pages/process-factory/special-craft/task-orders.ts',
  'src/pages/process-factory/special-craft/task-detail.ts',
  'src/pages/process-factory/special-craft/warehouse.ts',
  'src/pages/process-factory/special-craft/statistics.ts',
  'src/pages/process-factory/printing/warehouse.ts',
  'src/pages/process-factory/printing/statistics.ts',
  'src/pages/process-factory/dyeing/warehouse.ts',
  'src/pages/process-factory/dyeing/reports.ts',
  'src/pages/process-factory/cutting/fei-tickets.ts',
  'src/pages/process-factory/cutting/warehouse-hub.ts',
  'src/pages/process-factory/cutting/special-craft-dispatch.ts',
  'src/pages/process-factory/cutting/special-craft-return.ts',
  'src/pages/process-factory/cutting/sewing-dispatch.ts',
  'src/pages/process-factory/cutting/material-prep.ts',
  'src/pages/fcs-production-tech-pack-snapshot.ts',
  'src/pages/progress-board.ts',
  'src/data/app-shell-config.ts',
  'src/router/routes-fcs.ts',
  'src/router/route-renderers-fcs.ts',
  'scripts/check-menu-routes.mjs',
  'scripts/check-task-print-cards-foundation.ts',
  'scripts/check-pfos-task-print-entry-spread.ts',
  'scripts/check-process-factory-warehouse-menu-consolidation.ts',
  'scripts/check-cutting-warehouse-management-switch.ts',
  'scripts/check-task-card-entry-and-route-closure.ts',
  'scripts/check-cutting-special-craft-dispatch-return.ts',
  'scripts/check-cutting-sewing-dispatch.ts',
  'scripts/check-progress-statistics-linkage.ts',
  'scripts/check-special-craft-task-and-fei-flow-deepening.ts',
  'scripts/check-transfer-bag-mobile-closed-loop.ts',
  'scripts/check-menu-visibility-test-factory-and-default-views.ts',
  'scripts/check-process-craft-final-taxonomy.ts',
  'scripts/check-fcs-final-acceptance.ts',
  'docs/fcs-truth-source-final-acceptance.md',
  'docs/fcs-process-warehouse-unification.md',
  'docs/fcs-handover-writeback-and-difference-unification.md',
  'docs/fcs-statistics-dashboard-real-data.md',
]

requiredFiles.forEach(ensureExists)

const activeCrafts = listActiveProcessCraftDefinitions()
const removedCraftNameSet = new Set(removedLegacyCraftNames)
const specialCraftOperations = listSpecialCraftOperationDefinitions()
assert(!activeCrafts.some((item) => item.processCode === 'WASHING'), '活跃工艺中不应存在 WASHING')
removedLegacyProcessCodes.forEach((processCode) => {
  assert(!activeCrafts.some((item) => item.processCode === processCode), '活跃工艺中不应存在已删除旧编码')
})
assert(!activeCrafts.some((item) => removedCraftNameSet.has(item.craftName)), '活跃工艺中不应存在已删除旧项')
assertNoRemovedLegacyTerm(read('src/data/fcs/process-craft-dict.ts'), assert, '工序工艺字典源码不应保留已删除旧项')
assert(getProcessDefinitionByCode('SHRINKING')?.stageCode === 'PREP', '缩水必须归准备阶段')
assert(getProcessDefinitionByCode('POST_FINISHING')?.generatesExternalTask === true, '后道父任务必须产出任务')
assert(specialCraftOperations.length > 0, '缺少特殊工艺运营分类基础数据')
assert(
  specialCraftOperations.every((item) => item.processCode === 'SPECIAL_CRAFT' && !removedCraftNameSet.has(item.craftName)),
  '特殊工艺运营分类存在非法工艺引用',
)

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
;[
  joinText(['库存', '三态']),
  joinText(['available', 'Stock']),
  joinText(['occupied', 'Stock']),
  joinText(['inTransit', 'Stock']),
  joinText(['库位', '上架']),
  joinText(['拣货', '波次']),
  joinText(['WMS', '入库']),
].forEach((token) => {
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
;['纸样文件类型', '布料纸样', '针织纸样', '纸样分类', '解析纸样', '部位名称', '适用颜色', '每种颜色的片数', '特殊工艺', 'selectedSizeCodes', 'colorAllocations', 'specialCrafts', 'getPatternPieceSpecialCraftOptionsFromCurrentTechPack'].forEach((token) => {
  assert(techPackSource.includes(token), `技术包解析迁移口径缺少：${token}`)
})

const progressSource =
  read('src/pages/progress-board.ts') +
  read('src/pages/progress-board/task-domain.ts') +
  read('src/pages/progress-board/events.ts') +
  read('src/pages/progress-handover.ts') +
  read('src/pages/progress-material.ts') +
  read('src/pages/process-factory/printing/statistics.ts') +
  read('src/pages/process-factory/dyeing/reports.ts') +
  read('src/pages/process-factory/cutting/production-progress.ts') +
  read('src/pages/process-factory/cutting/cutting-summary.ts')
;['待交出', '待回写', '差异', '异议', '回货质检', '后道复检', '补料状态', '裁片仓状态'].forEach((token) => {
  assert(progressSource.includes(token), `进度口径缺少：${token}`)
})
;['打印任务流转卡', '打印任务交货卡'].forEach((token) => {
  assert(progressSource.includes(token), `平台运营入口缺少：${token}`)
})
assert(progressSource.includes('buildTaskDeliveryCardPrintLink(recordId)'), '任务进度看板详情交出记录必须按 recordId 打印任务交货卡')
assert(progressSource.includes('renderTaskDeliveryCardAction(record.recordId)'), '任务进度看板详情交出记录必须传入 record.recordId')

const taskPrintSource =
  read('src/data/fcs/task-print-cards.ts') +
  read('src/pages/print/task-route-card.ts') +
  read('src/pages/print/task-delivery-card.ts') +
  read('src/data/fcs/fcs-route-links.ts')
;['任务交货卡', '任务流转卡', 'buildTaskRouteCardPrintDoc', 'buildTaskDeliveryCardPrintDocByRecordId', '任务二维码', '任务交货二维码', '商品图片', '第几次交货'].forEach((token) => {
  assert(taskPrintSource.includes(token), `任务打印底座缺少：${token}`)
})

const routeSource =
  read('src/data/app-shell-config.ts') +
  read('src/router/routes-fcs.ts') +
  read('src/router/route-renderers-fcs.ts') +
  read('src/router/routes.ts') +
  read('src/router/route-renderers.ts')
;[
  '/fcs/production/orders',
  '/fcs/factory/warehouse',
  '/fcs/progress/board',
  '/fcs/progress/handover',
  '/fcs/print/task-route-card',
  '/fcs/print/task-delivery-card',
  '/fcs/progress/material',
  '/fcs/craft/printing/statistics',
  '/fcs/craft/printing/wait-process-warehouse',
  '/fcs/craft/printing/wait-handover-warehouse',
  '/fcs/craft/dyeing/wait-process-warehouse',
  '/fcs/craft/dyeing/wait-handover-warehouse',
  '/fcs/craft/dyeing/reports',
  '/fcs/craft/cutting/production-progress',
  '/fcs/craft/cutting/warehouse-management/wait-process',
  '/fcs/craft/cutting/warehouse-management/wait-handover',
  '/fcs/craft/cutting/warehouse-management/sample-warehouse',
  'special-craft',
  'renderSpecialCraftWaitProcessWarehousePage',
  'renderSpecialCraftWaitHandoverWarehousePage',
  'renderSpecialCraftTaskOrdersPage',
  'renderSpecialCraftWarehousePage',
  'renderSpecialCraftStatisticsPage',
  '/confirmation-print',
].forEach((token) => {
  assert(routeSource.includes(token), `路由注册缺少：${token}`)
})
;[
  "renderRouteRedirect('/fcs/craft/printing/wait-process-warehouse', '正在跳转到印花待加工仓')",
  "renderRouteRedirect('/fcs/craft/dyeing/wait-process-warehouse', '正在跳转到染色待加工仓')",
  "renderRouteRedirect('/fcs/craft/cutting/warehouse-management/wait-process', '正在跳转到待加工仓')",
  'renderRouteRedirect(buildSpecialCraftWaitProcessWarehousePath(operation)',
].forEach((token) => {
  assert(routeSource.includes(token), `旧仓库入口兼容跳转缺少：${token}`)
})

const forbiddenUiTerms = [
  '去交接（待交出）',
  ['交出', '头'].join(''),
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
