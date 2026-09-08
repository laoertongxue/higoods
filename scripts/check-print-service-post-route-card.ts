import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  loadPostFinishingDemoData,
  listPostFinishingFullFlowPostTasks,
} from '../src/data/fcs/post-finishing-full-flow.ts'
import {
  buildPrintDocument,
  getPrintTemplateForRequest,
  renderPrintDocument,
} from '../src/data/fcs/print-template-registry.ts'

loadPostFinishingDemoData()
const task = listPostFinishingFullFlowPostTasks()[0]
assert.ok(task, '当前全流程必须包含可打印后道加工单')

const template = getPrintTemplateForRequest({
  documentType: 'TASK_ROUTE_CARD',
  sourceType: 'POST_FINISHING_WORK_ORDER',
  sourceId: task.postTaskId,
})
assert.equal(template?.templateCode, 'POST_FINISHING_ROUTE_CARD', '后道加工单必须命中专用流转卡模板')

const document = buildPrintDocument({
  documentType: 'TASK_ROUTE_CARD',
  sourceType: 'POST_FINISHING_WORK_ORDER',
  sourceId: task.postTaskId,
})
assert.equal(document.printTitle, '后道加工单流转卡')
assert.ok(document.printSubtitle.includes('QC → 后道加工 → 处理后交出复核 → 成衣仓交接'), '打印流程必须使用当前全流程口径')
assert.ok(document.qrCodes[0]?.sizeMm >= 26 && document.qrCodes[0]?.sizeMm <= 32, '二维码尺寸必须为 26mm 至 32mm')
assert.equal(document.differenceBlocks[0]?.minRows, 3, '差异记录区必须保留空白手写行')
const routeRows = document.tables.find((table) => table.tableId === 'route-nodes')?.rows || []
assert.deepEqual(routeRows.map((row) => row[0]), ['扫码收货', '质检', '后道处理', '处理后交出复核', '交出'])
assert.ok(document.sections.some((section) => section.title === '后道处理区' && section.fields.some((field) => field.label === '本批后道项目')), '打印必须展示单头本批后道项目')
assert.ok(document.sections.some((section) => section.title === '处理后交出复核区'), '打印必须保留数量与条码交出复核')

const html = renderPrintDocument(document)
for (const forbidden of ['实际工序', '阶段任务', '实际工序单', '车缝+后道', 'HiGood 顶部导航', '商品中心系统']) {
  assert.ok(!html.includes(forbidden), `当前后道打印不得出现 ${forbidden}`)
}
assert.ok(!html.includes('renderAppShell') && !html.includes('data-shell-tab'), '打印不得渲染业务系统壳')

const templateSource = readFileSync(new URL('../src/pages/print/templates/post-finishing-route-card-template.ts', import.meta.url), 'utf8')
assert.ok(templateSource.includes('post-finishing-current-read-model.ts'), '后道打印必须读取当前全流程只读投影')
assert.ok(!templateSource.includes('post-finishing-domain.ts'), '后道打印不得再读取旧后道加工/QC/复检事实')

console.log('当前后道加工单流转卡专项契约通过。')
