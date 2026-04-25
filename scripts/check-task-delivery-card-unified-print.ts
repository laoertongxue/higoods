import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildPrintDocument,
  getPrintTemplateForRequest,
  renderPrintDocument,
} from '../src/data/fcs/print-template-registry.ts'
import { buildTaskDeliveryCardPrintLink } from '../src/data/fcs/fcs-route-links.ts'
import {
  listProcessHandoverRecords,
  type ProcessWarehouseCraftType,
} from '../src/data/fcs/process-warehouse-domain.ts'
import {
  getPdaHandoverRecordsByHead,
  listPdaHandoverHeads,
} from '../src/data/fcs/pda-handover-events.ts'
import {
  buildCuttingDeliveryCardPrintDocument,
  buildDyeingDeliveryCardPrintDocument,
  buildPostFinishingDeliveryCardPrintDocument,
  buildPrintingDeliveryCardPrintDocument,
  buildRuntimeTaskDeliveryCardPrintDocument,
  buildSewingDeliveryCardPrintDocument,
  buildSpecialCraftDeliveryCardPrintDocument,
  buildTaskDeliveryCardPrintDocument,
} from '../src/pages/print/templates/task-delivery-card-template.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertFile(path: string, message: string): void {
  assert(existsSync(join(root, path)), message)
}

function assertIncludes(source: string, needle: string, message: string): void {
  assert(source.includes(needle), message)
}

function assertNotIncludes(source: string, needle: string, message: string): void {
  assert(!source.includes(needle), message)
}

function getUnifiedHandoverId(craftType: ProcessWarehouseCraftType): string {
  const record = listProcessHandoverRecords({ craftType })[0]
  assert(record, `缺少 ${craftType} 统一交出记录 mock`)
  return record.handoverRecordId
}

function getPdaHandoverId(keyword: string): string {
  const head = listPdaHandoverHeads()
    .filter((item) => item.headType === 'HANDOUT')
    .find((item) => `${item.processBusinessName || ''} ${item.craftName || ''} ${item.taskNo || ''}`.includes(keyword))
  const record = head ? getPdaHandoverRecordsByHead(head.handoverId)[0] : undefined
  assert(head && record, `缺少 ${keyword} 交出记录 mock`)
  return record.handoverRecordId || record.recordId
}

function deliveryDocText(handoverRecordId: string): string {
  const doc = buildPrintDocument({
    documentType: 'TASK_DELIVERY_CARD',
    sourceType: 'HANDOVER_RECORD',
    sourceId: handoverRecordId,
    handoverRecordId,
  })
  return JSON.stringify(doc) + renderPrintDocument(doc)
}

const printService = read('src/data/fcs/print-service.ts')
const registry = read('src/data/fcs/print-template-registry.ts')
const previewPage = read('src/pages/print/print-preview.ts')
const deliveryPage = read('src/pages/print/task-delivery-card.ts')
const deliveryTemplate = read('src/pages/print/templates/task-delivery-card-template.ts')
const routeTemplate = read('src/pages/print/templates/task-route-card-template.ts')
const postRouteTemplate = read('src/pages/print/templates/post-finishing-route-card-template.ts')
const routeLinks = read('src/data/fcs/fcs-route-links.ts')
const routes = read('src/router/routes-fcs.ts')
const processWarehouse = read('src/data/fcs/process-warehouse-domain.ts')

;[
  'src/data/fcs/print-service.ts',
  'src/data/fcs/print-template-registry.ts',
  'src/pages/print/print-preview.ts',
  'src/pages/print/templates/task-delivery-card-template.ts',
  'src/pages/print/task-delivery-card.ts',
].forEach((path) => assertFile(path, `缺少任务交货卡统一打印文件：${path}`))

assertIncludes(printService, 'export interface PrintDocument', '第 1 步统一 PrintDocument 不存在')
assertIncludes(registry, 'POST_FINISHING_ROUTE_CARD', '第 1 步后道任务流转卡注册丢失')
assertIncludes(routeTemplate + postRouteTemplate, 'buildPostFinishingRouteCardPrintDocument', '第 1 步后道任务流转卡 adapter 丢失')
assertIncludes(routeTemplate, 'buildPrintingWorkOrderRouteCardPrintDocument', '第 2 步任务流转卡统一 adapter 丢失')
assertIncludes(routeTemplate, 'buildCuttingMergeBatchRouteCardPrintDocument', '第 2 步裁片批次任务流转卡 adapter 丢失')
assertIncludes(printService, 'TASK_DELIVERY_CARD', '缺少 TASK_DELIVERY_CARD 文档类型')
assertIncludes(printService, 'HANDOVER_RECORD', '缺少 HANDOVER_RECORD 打印来源类型')
assertIncludes(registry, 'TASK_DELIVERY_CARD', '任务交货卡未注册模板')
assertIncludes(registry, 'renderTaskDeliveryCardTemplate', '任务交货卡未接入统一模板渲染')
assertIncludes(deliveryTemplate, 'TaskDeliveryCardTemplate', '缺少统一任务交货卡模板语义')
assertIncludes(deliveryTemplate, 'buildTaskDeliveryCardPrintDocument', '缺少任务交货卡 PrintDocument 构建函数')

;[
  'buildRuntimeTaskDeliveryCardPrintDocument',
  'buildPrintingDeliveryCardPrintDocument',
  'buildDyeingDeliveryCardPrintDocument',
  'buildSpecialCraftDeliveryCardPrintDocument',
  'buildPostFinishingDeliveryCardPrintDocument',
  'buildCuttingDeliveryCardPrintDocument',
  'buildSewingDeliveryCardPrintDocument',
].forEach((adapterName) => {
  assertIncludes(deliveryTemplate, adapterName, `缺少任务交货卡 adapter：${adapterName}`)
})

assertIncludes(routeLinks, 'buildTaskDeliveryCardPrintLink', '旧 buildTaskDeliveryCardPrintLink 必须保留')
assertIncludes(routeLinks, 'TASK_DELIVERY_CARD', 'buildTaskDeliveryCardPrintLink 必须进入统一打印预览')
assert(buildTaskDeliveryCardPrintLink('HDR-CHECK').startsWith('/fcs/print/preview?'), '任务交货卡链接未进入统一打印预览')
assertIncludes(routes, "'/fcs/print/task-delivery-card'", '旧 /fcs/print/task-delivery-card 路由必须保留')
assertIncludes(routes, '/fcs\\/task-print\\/delivery-card', '旧 /fcs/task-print/delivery-card 兼容路由必须保留')
assertIncludes(deliveryPage, 'renderUnifiedPrintPreviewPage', '旧任务交货卡路由必须接入统一打印壳')

assertNotIncludes(previewPage + deliveryTemplate, 'renderAppShell', '任务交货卡打印页不得渲染系统顶部导航')
assertNotIncludes(previewPage + deliveryTemplate, 'renderSidebar', '任务交货卡打印页不得渲染左侧菜单')
assertNotIncludes(previewPage + deliveryTemplate, 'data-shell-tab', '任务交货卡打印页不得渲染业务 Tab')
assertNotIncludes(deliveryTemplate, '系统占位图', '任务交货卡不得显示大块系统占位图')
assertIncludes(deliveryTemplate, '暂无商品图', '无图时必须使用紧凑“暂无商品图”')
assertIncludes(deliveryTemplate, 'size: 112', '二维码区不得占据整页主体')
assertIncludes(deliveryTemplate, '交出方与接收方', '任务交货卡必须包含交出方与接收方')
assertIncludes(deliveryTemplate, '本次交出信息区', '任务交货卡必须包含本次交出信息区')
assertIncludes(deliveryTemplate, '交出明细表', '任务交货卡必须包含交出明细表')
assertIncludes(deliveryTemplate, '回写信息区', '任务交货卡必须包含回写信息区')
assertIncludes(deliveryTemplate, '差异记录区', '任务交货卡必须包含差异记录区')
assertIncludes(deliveryTemplate, '签字区', '任务交货卡必须包含签字区')
assertIncludes(deliveryTemplate, '扫码查看交出记录', '任务交货卡必须包含交出二维码说明')

assertIncludes(processWarehouse, 'ProcessHandoverRecord', '任务交货卡必须优先读取统一交出记录')
assertIncludes(processWarehouse, 'ProcessHandoverDifferenceRecord', '任务交货卡必须能读取统一差异记录')

const printingId = getUnifiedHandoverId('PRINT')
const dyeingId = getUnifiedHandoverId('DYE')
const specialCraftId = getUnifiedHandoverId('SPECIAL_CRAFT')
const postFinishingId = getUnifiedHandoverId('POST_FINISHING')
const sewingId = getPdaHandoverId('车缝')
const cuttingId = getPdaHandoverId('裁片')
const runtimeId = sewingId

const template = getPrintTemplateForRequest({
  documentType: 'TASK_DELIVERY_CARD',
  sourceType: 'HANDOVER_RECORD',
  sourceId: printingId,
  handoverRecordId: printingId,
})
assert(template?.templateCode === 'TASK_DELIVERY_CARD', 'TASK_DELIVERY_CARD 未接入统一模板注册')

const runtimeDoc = buildRuntimeTaskDeliveryCardPrintDocument(runtimeId)
const printingDoc = buildPrintingDeliveryCardPrintDocument(printingId)
const dyeingDoc = buildDyeingDeliveryCardPrintDocument(dyeingId)
const specialCraftDoc = buildSpecialCraftDeliveryCardPrintDocument(specialCraftId)
const postFinishingDoc = buildPostFinishingDeliveryCardPrintDocument(postFinishingId)
const cuttingDoc = buildCuttingDeliveryCardPrintDocument(cuttingId)
const sewingDoc = buildSewingDeliveryCardPrintDocument(sewingId)
const commonDoc = buildTaskDeliveryCardPrintDocument(printingId)

;[
  runtimeDoc,
  printingDoc,
  dyeingDoc,
  specialCraftDoc,
  postFinishingDoc,
  cuttingDoc,
  sewingDoc,
  commonDoc,
].forEach((doc, index) => {
  const text = JSON.stringify(doc)
  assert(doc.documentType === 'TASK_DELIVERY_CARD', `第 ${index + 1} 张交货卡 documentType 错误`)
  assert(doc.templateCode === 'TASK_DELIVERY_CARD', `第 ${index + 1} 张交货卡未使用统一模板`)
  assertIncludes(text, '交出方与接收方', `第 ${index + 1} 张交货卡缺少交出方与接收方`)
  assertIncludes(text, '本次交出', `第 ${index + 1} 张交货卡缺少本次交出对象数量`)
  assertIncludes(text, '实收', `第 ${index + 1} 张交货卡缺少实收对象数量`)
  assertIncludes(text, '差异', `第 ${index + 1} 张交货卡缺少差异对象数量`)
  assertIncludes(text, '交出明细表', `第 ${index + 1} 张交货卡缺少交出明细表`)
  assertIncludes(text, '回写信息区', `第 ${index + 1} 张交货卡缺少回写信息区`)
  assertIncludes(text, '差异记录区', `第 ${index + 1} 张交货卡缺少差异记录区`)
  assertIncludes(text, '签字', `第 ${index + 1} 张交货卡缺少签字区`)
  assertIncludes(text, 'targetRoute', `第 ${index + 1} 张交货卡二维码缺少 targetRoute`)
})

const printText = deliveryDocText(printingId)
const dyeText = deliveryDocText(dyeingId)
const specialText = deliveryDocText(specialCraftId)
const postText = deliveryDocText(postFinishingId)
const cutText = deliveryDocText(cuttingId)
const sewText = deliveryDocText(sewingId)

;['印花任务交货卡', '印花', '交出面料', '实收面料', '差异面料'].forEach((token) => assertIncludes(printText, token, `印花交货卡缺少 ${token}`))
;['染色任务交货卡', '染色', '交出面料', '实收面料', '差异面料'].forEach((token) => assertIncludes(dyeText, token, `染色交货卡缺少 ${token}`))
;['特殊工艺任务交货卡', '关联菲票', '交出裁片', '实收裁片', '差异裁片'].forEach((token) => assertIncludes(specialText, token, `特殊工艺交货卡缺少 ${token}`))
;['后道任务交货卡', '复检完成后的后道交出仓', '交出成衣', '实收成衣', '差异成衣'].forEach((token) => assertIncludes(postText, token, `后道交货卡缺少 ${token}`))
;['裁片任务交货卡', '裁片', '交出裁片'].forEach((token) => assertIncludes(cutText, token, `裁片交货卡缺少 ${token}`))
;['车缝任务交货卡', '车缝', '交出成衣'].forEach((token) => assertIncludes(sewText, token, `车缝交货卡缺少 ${token}`))

assertNotIncludes(dyeText + read('src/pages/process-factory/dyeing/reports.ts'), '染色报表', '用户可见文案不得出现染色报表')
assertNotIncludes(postText + deliveryTemplate, '车缝厂完成后道后直接生成后道交货卡', '不得让车缝厂完成后道后直接生成后道交货卡')
assertNotIncludes(sewText, '开始质检', '车缝交货卡不得显示车缝工厂执行质检')
assertNotIncludes(sewText, '开始复检', '车缝交货卡不得显示车缝工厂执行复检')
;['开扣眼', '装扣子', '熨烫'].forEach((term) => {
  assertNotIncludes(postText + deliveryTemplate, term, `后道交货卡不得出现错误动作：${term}`)
})
assertNotIncludes(cutText, '合并裁剪批次作为菲票归属主体', '裁片交货卡不得把合并裁剪批次作为菲票归属主体')
assertNotIncludes(deliveryTemplate, '数量：', '任务交货卡不得只写数量')

assertIncludes(read('src/pages/print/task-route-card.ts'), 'renderUnifiedPrintPreviewPage', '任务流转卡打印入口被破坏')
assertIncludes(read('src/pages/production/confirmation-print.ts'), '生产确认单', '生产确认单入口被破坏')
assertIncludes(read('src/pages/process-factory/cutting/fei-tickets.ts'), '菲票', '菲票入口被破坏')
assertIncludes(read('src/pages/process-factory/cutting/material-prep.ts'), '配料', '配料单入口被破坏')
assertIncludes(read('src/pages/settlement/request-domain.ts'), '结算信息变更申请单', '结算信息变更申请单入口被破坏')

console.log('task delivery card unified print checks passed')
