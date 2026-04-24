import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildTaskDeliveryCardPrintDocByRecordId,
  buildTaskRouteCardPrintDoc,
  TASK_DELIVERY_CARD_NAME,
  TASK_ROUTE_CARD_NAME,
} from '../src/data/fcs/task-print-cards.ts'
import {
  getPdaHandoverRecordsByHead,
  listPdaHandoverHeads,
} from '../src/data/fcs/pda-handover-events.ts'
import { getHandoverRecordQrDisplayValue } from '../src/data/fcs/task-handover-domain.ts'
import { buildTaskQrValue } from '../src/data/fcs/task-qr.ts'
import { listRuntimeProcessTasks } from '../src/data/fcs/runtime-process-tasks.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function resolveRepoPath(relativePath: string): string {
  return path.resolve(repoRoot, relativePath)
}

function read(relativePath: string): string {
  return fs.readFileSync(resolveRepoPath(relativePath), 'utf8')
}

function exists(relativePath: string): boolean {
  return fs.existsSync(resolveRepoPath(relativePath))
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function phrase(parts: string[]): string {
  return parts.join('')
}

function assertNoVisibleBannedTerms(scopeName: string, source: string): void {
  const bannedTerms = [
    phrase(['随货', '交接标签']),
    phrase(['随', '货单']),
    phrase(['工艺', '流转卡']),
    phrase(['生产', '流程卡']),
    'PDA',
    'QR payload',
    'JSON',
    phrase(['A', 'PI']),
  ]
  bannedTerms.forEach((term) => assertNotIncludes(source, term, `${scopeName} 出现禁用用户可见文案：${term}`))
}

assert.equal(TASK_DELIVERY_CARD_NAME, '任务交货卡', '任务交货卡正式名称不正确')
assert.equal(TASK_ROUTE_CARD_NAME, '任务流转卡', '任务流转卡正式名称不正确')

;[
  'src/data/fcs/task-print-cards.ts',
  'src/pages/print/task-route-card.ts',
  'src/pages/print/task-delivery-card.ts',
].forEach((file) => assert(exists(file), `缺少文件：${file}`))

const domainSource = read('src/data/fcs/task-print-cards.ts')
const routeLinksSource = read('src/data/fcs/fcs-route-links.ts')
const routeSource = read('src/router/routes-fcs.ts')
const rendererSource = read('src/router/route-renderers-fcs.ts')
const routePageSource = read('src/pages/print/task-route-card.ts')
const deliveryPageSource = read('src/pages/print/task-delivery-card.ts')
const progressTaskSource = read('src/pages/progress-board/task-domain.ts') + read('src/pages/progress-board/events.ts')
const handoverPageSource = read('src/pages/progress-handover.ts')
const printPagesSource = routePageSource + deliveryPageSource

assertIncludes(routeLinksSource, 'buildTaskRouteCardPrintLink', '缺少任务流转卡 route builder')
assertIncludes(routeLinksSource, 'buildTaskDeliveryCardPrintLink', '缺少任务交货卡 route builder')
assertIncludes(routeLinksSource, '/fcs/print/task-route-card?sourceType=', '任务流转卡 route builder 未使用正式预览页')
assertIncludes(routeLinksSource, '/fcs/print/task-delivery-card?handoverRecordId=', '任务交货卡 route builder 未按交出记录生成链接')
assertIncludes(routeSource, '/fcs/print/task-route-card', '缺少任务流转卡路由注册')
assertIncludes(routeSource, '/fcs/print/task-delivery-card', '缺少任务交货卡路由注册')
assertIncludes(rendererSource, "../pages/print/task-route-card", '任务流转卡渲染器未指向正式预览页')
assertIncludes(rendererSource, "../pages/print/task-delivery-card", '任务交货卡渲染器未指向正式预览页')

assertIncludes(domainSource, 'export interface TaskRouteCardPrintDoc', '缺少任务流转卡打印领域模型')
assertIncludes(domainSource, 'export interface TaskDeliveryCardPrintDoc', '缺少任务交货卡打印领域模型')
assertIncludes(domainSource, 'buildTaskRouteCardPrintDoc', '缺少任务流转卡 builder')
assertIncludes(domainSource, 'buildTaskDeliveryCardPrintDocByRecordId', '缺少任务交货卡 builder')
assertIncludes(domainSource, 'findHandoutRecordContext', '任务交货卡必须先定位交出记录上下文')
assertIncludes(domainSource, 'getHandoverRecordQrDisplayValue(record)', '任务交货卡二维码必须来自交出记录')
assertIncludes(domainSource, 'buildTaskQrValue', '任务流转卡二维码必须来自任务二维码')
assertIncludes(domainSource, 'deliverySequenceLabel', '任务交货卡缺少第 N 次交货字段')
assertIncludes(domainSource, 'resolveTaskPrintImage', '缺少统一图片解析 helper')
assertIncludes(domainSource, 'buildSystemPlaceholderImage', '缺少系统占位图兜底')

assertIncludes(progressTaskSource, '打印任务流转卡', '任务进度看板缺少打印任务流转卡入口')
assertIncludes(progressTaskSource, "buildTaskRouteCardPrintLink('RUNTIME_TASK', task.taskId)", '任务进度看板入口必须使用 RUNTIME_TASK + taskId')
assertIncludes(handoverPageSource, '打印任务交货卡', '交接链路页缺少打印任务交货卡入口')
assertIncludes(handoverPageSource, 'buildTaskDeliveryCardPrintLink(recordId)', '交接链路页任务交货卡必须使用 handoverRecordId')

assertIncludes(routePageSource, 'window.print()', '任务流转卡预览页缺少打印按钮')
assertIncludes(deliveryPageSource, 'window.print()', '任务交货卡预览页缺少打印按钮')
assertIncludes(printPagesSource + read('src/pages/print/task-card-shared.ts'), '商品图片', '任务打印预览页缺少图片区')
assertIncludes(routePageSource, '任务二维码', '任务流转卡缺少二维码区')
assertIncludes(deliveryPageSource, '任务交货二维码', '任务交货卡缺少二维码区')
assertIncludes(deliveryPageSource, '第几次交货', '任务交货卡页头缺少第几次交货')
assertNotIncludes(printPagesSource, "window.open('', '_blank')", '新打印页不得拼接新窗口 HTML')

const runtimeTask =
  listRuntimeProcessTasks().find((task) => task.taskQrValue)
  ?? listRuntimeProcessTasks()[0]
  ?? listPdaGenericProcessTasks().find((task) => task.taskQrValue)
  ?? listPdaGenericProcessTasks()[0]
assert(runtimeTask, '缺少可用于任务流转卡的 RUNTIME_TASK 样例')
const routeDoc = buildTaskRouteCardPrintDoc({ sourceType: 'RUNTIME_TASK', sourceId: runtimeTask.taskId })
assert.equal(routeDoc.docType, 'TASK_ROUTE_CARD', '任务流转卡 docType 错误')
assert.equal(routeDoc.sourceType, 'RUNTIME_TASK', '任务流转卡来源类型错误')
assert.equal(routeDoc.taskId, runtimeTask.taskId, '任务流转卡未绑定当前任务')
assert.equal(routeDoc.qrLabel, '任务二维码', '任务流转卡二维码标签错误')
assert.equal(routeDoc.qrValue, runtimeTask.taskQrValue || buildTaskQrValue(runtimeTask.taskId), '任务流转卡二维码值错误')
assert(routeDoc.imageUrl.trim().length > 0, '任务流转卡图片不能为空')
assert(routeDoc.summaryRows.some((row) => row.label === '任务编号'), '任务流转卡缺少任务信息区')
assertIncludes(read('src/pages/print/task-card-shared.ts'), 'const minRows = 8', '任务流转卡缺少 8 行空白流转记录兜底')

const handoutHead = listPdaHandoverHeads().find((head) => head.headType === 'HANDOUT' && getPdaHandoverRecordsByHead(head.handoverId).length > 0)
assert(handoutHead, '缺少可用于任务交货卡的交出单样例')
const handoutRecord = getPdaHandoverRecordsByHead(handoutHead.handoverId)[0]
assert(handoutRecord, '缺少可用于任务交货卡的交出记录样例')
const handoverRecordId = handoutRecord.handoverRecordId || handoutRecord.recordId
const deliveryDoc = buildTaskDeliveryCardPrintDocByRecordId(handoverRecordId)
assert.equal(deliveryDoc.docType, 'TASK_DELIVERY_CARD', '任务交货卡 docType 错误')
assert.equal(deliveryDoc.handoverRecordId, handoverRecordId, '任务交货卡必须绑定交出记录')
assert.equal(deliveryDoc.sequenceNo, handoutRecord.sequenceNo, '任务交货卡第几次交货必须来自 record.sequenceNo')
assert.equal(deliveryDoc.deliverySequenceLabel, `第 ${handoutRecord.sequenceNo} 次交货`, '任务交货卡第 N 次交货文案错误')
assert.equal(deliveryDoc.qrLabel, '任务交货二维码', '任务交货卡二维码标签错误')
assert.equal(deliveryDoc.qrValue, getHandoverRecordQrDisplayValue(handoutRecord), '任务交货卡二维码必须来自交出记录二维码')
assert(deliveryDoc.imageUrl.trim().length > 0, '任务交货卡图片不能为空')
assert(deliveryDoc.lineRows.length > 0, '任务交货卡必须展示交出记录明细')
;['交出单号', '交货记录号', '第几次交货'].forEach((label) => {
  assert(deliveryDoc.summaryRows.some((row) => row.label === label), `任务交货卡信息区缺少：${label}`)
})

const productionConfirmationSource = read('src/pages/production/confirmation-print.ts')
assertIncludes(productionConfirmationSource, '生产确认单', '生产确认单打印能力被破坏')
assertIncludes(productionConfirmationSource, 'window.print()', '生产确认单打印按钮被破坏')
assertIncludes(read('src/pages/process-factory/cutting/material-prep.ts'), '配料单', '配料单打印能力被破坏')
assertIncludes(read('src/pages/process-factory/cutting/fei-tickets.ts'), '菲票', '菲票打印能力被破坏')
assertIncludes(read('src/pages/process-factory/cutting/transfer-bags.ts'), '中转袋', '袋码 / 中转单打印能力被破坏')

assertNoVisibleBannedTerms('任务打印预览页', printPagesSource)
assertNoVisibleBannedTerms('平台任务打印入口', progressTaskSource + handoverPageSource)

console.log('[check-task-print-cards-foundation] 任务交货卡 / 任务流转卡打印底座通过')
