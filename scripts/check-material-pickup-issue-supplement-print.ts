import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildPrintDocument,
  getPrintTemplateForRequest,
  renderPrintDocument,
} from '../src/data/fcs/print-template-registry.ts'
import {
  buildIssueSlipPrintLink,
  buildMaterialPrepSlipPrintLink,
  buildPickupSlipPrintLink,
  buildSupplementMaterialSlipPrintLink,
} from '../src/data/fcs/fcs-route-links.ts'
import { buildMaterialPrepProjection } from '../src/pages/process-factory/cutting/material-prep-projection.ts'
import { commonPickupSlips } from '../src/domain/pickup/mock.ts'
import { listCuttingSewingDispatchOrders } from '../src/data/fcs/cutting/sewing-dispatch.ts'
import { replenishmentSuggestionRecords } from '../src/data/fcs/cutting/replenishment.ts'

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

function docText(documentType: any, sourceType: any, sourceId: string): string {
  const document = buildPrintDocument({ documentType, sourceType, sourceId })
  return JSON.stringify(document) + renderPrintDocument(document)
}

const printService = read('src/data/fcs/print-service.ts')
const registry = read('src/data/fcs/print-template-registry.ts')
const preview = read('src/pages/print/print-preview.ts')
const template = read('src/pages/print/templates/material-slip-template.ts')
const routeLinks = read('src/data/fcs/fcs-route-links.ts')
const materialPrepPage = read('src/pages/process-factory/cutting/material-prep.ts')
const pickupPage = read('src/pages/pda-cutting-pickup.ts')
const sewingDispatchPage = read('src/pages/process-factory/cutting/sewing-dispatch.ts')
const replenishmentPage = read('src/pages/process-factory/cutting/replenishment.ts')

;[
  'src/data/fcs/print-service.ts',
  'src/data/fcs/print-template-registry.ts',
  'src/pages/print/print-preview.ts',
  'src/pages/print/templates/material-slip-template.ts',
].forEach((path) => assertFile(path, `缺少配料领料类统一打印文件：${path}`))

assertIncludes(printService, 'PrintDocument', '第 1 步统一 PrintDocument 不存在')
assertIncludes(registry, 'TASK_ROUTE_CARD', '第 2 步任务流转卡注册回退')
assertIncludes(registry, 'TASK_DELIVERY_CARD', '第 3 步任务交货卡注册回退')

;[
  'MATERIAL_PREP_SLIP',
  'PICKUP_SLIP',
  'ISSUE_SLIP',
  'SUPPLEMENT_MATERIAL_SLIP',
].forEach((documentType) => {
  assertIncludes(printService + registry + template, documentType, `缺少文档类型：${documentType}`)
})

;[
  'MaterialPrepSlipTemplate',
  'PickupSlipTemplate',
  'IssueSlipTemplate',
  'SupplementMaterialSlipTemplate',
  'MaterialTransferSlipTemplate',
].forEach((templateName) => {
  assertIncludes(template, templateName, `缺少模板语义：${templateName}`)
})

;[
  'buildMaterialPrepSlipPrintDocument',
  'buildPickupSlipPrintDocument',
  'buildIssueSlipPrintDocument',
  'buildSupplementMaterialSlipPrintDocument',
].forEach((adapterName) => {
  assertIncludes(template + registry, adapterName, `缺少打印 adapter：${adapterName}`)
})

;[
  'buildMaterialPrepSlipPrintLink',
  'buildPickupSlipPrintLink',
  'buildIssueSlipPrintLink',
  'buildSupplementMaterialSlipPrintLink',
  'buildUnifiedPrintPreviewLink',
].forEach((linkName) => {
  assertIncludes(routeLinks, linkName, `缺少打印链接函数：${linkName}`)
})

assert(buildMaterialPrepSlipPrintLink('MP-CHECK').startsWith('/fcs/print/preview?'), '配料单链接未进入统一打印预览')
assert(buildPickupSlipPrintLink('PK-CHECK').startsWith('/fcs/print/preview?'), '领料单链接未进入统一打印预览')
assert(buildIssueSlipPrintLink('IS-CHECK').startsWith('/fcs/print/preview?'), '发料单链接未进入统一打印预览')
assert(buildSupplementMaterialSlipPrintLink('RP-CHECK').startsWith('/fcs/print/preview?'), '补料单链接未进入统一打印预览')

assertIncludes(materialPrepPage, '打印配料单', '裁床配料页面缺少打印配料单入口')
assertIncludes(materialPrepPage, 'buildMaterialPrepSlipPrintLink', '裁床配料单入口未接入统一打印链接')
assertIncludes(pickupPage, '打印领料单', 'PDA 领料页缺少打印领料单入口')
assertIncludes(pickupPage, 'buildPickupSlipPrintLink', '领料单入口未接入统一打印链接')
assertIncludes(sewingDispatchPage, '打印发料单', '发料页面缺少打印发料单入口')
assertIncludes(sewingDispatchPage, 'buildIssueSlipPrintLink', '发料单入口未接入统一打印链接')
assertIncludes(replenishmentPage, '打印补料单', '补料页面缺少打印补料单入口')
assertIncludes(replenishmentPage, 'buildSupplementMaterialSlipPrintLink', '补料单入口未接入统一打印链接')

const printIssueListBody = materialPrepPage.slice(materialPrepPage.indexOf('function printIssueList'), materialPrepPage.indexOf('export function renderCraftCuttingMaterialPrepPage'))
assertNotIncludes(printIssueListBody, 'window.open', '裁床配料单不得继续使用 window.open 临时打印')
assertNotIncludes(printIssueListBody, 'document.write', '裁床配料单不得继续使用 printWindow.document.write')
assertNotIncludes(printIssueListBody, 'printWindow.print', '裁床配料单不得继续使用 printWindow.print')

assertNotIncludes(preview + template, 'renderAppShell', '打印页不得渲染系统顶部导航')
assertNotIncludes(preview + template, 'renderSidebar', '打印页不得渲染左侧菜单')
assertNotIncludes(preview + template, 'data-shell-tab', '打印页不得渲染业务 Tab')
assertNotIncludes(template, '系统占位图', '四类单据不得显示大块系统占位图')
assertIncludes(template, '暂无商品图', '无图时必须紧凑显示暂无商品图')
assertIncludes(template, 'size: 112', '二维码区不得占据整页主体')

const materialRow = buildMaterialPrepProjection().rows[0]
const pickup = commonPickupSlips[0]
const issue = listCuttingSewingDispatchOrders()[0]
const supplement = replenishmentSuggestionRecords[0]
assert(materialRow, '缺少配料单 mock 数据')
assert(pickup, '缺少领料单 mock 数据')
assert(issue, '缺少发料单 mock 数据')
assert(supplement, '缺少补料单 mock 数据')

const materialTemplate = getPrintTemplateForRequest({ documentType: 'MATERIAL_PREP_SLIP', sourceType: 'MATERIAL_PREP_RECORD', sourceId: materialRow.id })
const pickupTemplate = getPrintTemplateForRequest({ documentType: 'PICKUP_SLIP', sourceType: 'PICKUP_SLIP_RECORD', sourceId: pickup.pickupSlipNo })
const issueTemplate = getPrintTemplateForRequest({ documentType: 'ISSUE_SLIP', sourceType: 'ISSUE_SLIP_RECORD', sourceId: issue.dispatchOrderId })
const supplementTemplate = getPrintTemplateForRequest({ documentType: 'SUPPLEMENT_MATERIAL_SLIP', sourceType: 'SUPPLEMENT_MATERIAL_RECORD', sourceId: supplement.id })
assert(materialTemplate?.templateCode === 'MATERIAL_PREP_SLIP', '配料单未接入模板注册表')
assert(pickupTemplate?.templateCode === 'PICKUP_SLIP', '领料单未接入模板注册表')
assert(issueTemplate?.templateCode === 'ISSUE_SLIP', '发料单未接入模板注册表')
assert(supplementTemplate?.templateCode === 'SUPPLEMENT_MATERIAL_SLIP', '补料单未接入模板注册表')

const materialDoc = docText('MATERIAL_PREP_SLIP', 'MATERIAL_PREP_RECORD', materialRow.id)
const pickupDoc = docText('PICKUP_SLIP', 'PICKUP_SLIP_RECORD', pickup.pickupSlipNo)
const issueDoc = docText('ISSUE_SLIP', 'ISSUE_SLIP_RECORD', issue.dispatchOrderId)
const supplementDoc = docText('SUPPLEMENT_MATERIAL_SLIP', 'SUPPLEMENT_MATERIAL_RECORD', supplement.id)

;['配料单', '来源生产单', '原始裁片单', '裁片单二维码', '应配面料米数', '已配面料米数', '缺口面料米数', '配置卷数', '扫码查看裁片单配料与领料信息', '签字区'].forEach((token) => assertIncludes(materialDoc, token, `配料单缺少 ${token}`))
;['领料单', '领料工厂', '发料仓库', '打印版本', '应领对象数量', '实领对象数量', '差异对象数量', '扫码确认领料', '签字区'].forEach((token) => assertIncludes(pickupDoc, token, `领料单缺少 ${token}`))
;['发料单', '发料仓库', '接收工厂', '应发对象数量', '实发对象数量', '差异对象数量', '扫码查看发料记录', '签字区'].forEach((token) => assertIncludes(issueDoc, token, `发料单缺少 ${token}`))
;['补料单', '补料原因', '原需求对象数量', '缺口对象数量', '申请补料对象数量', '审核通过对象数量', '实发补料对象数量', '扫码查看补料申请与发料记录', '签字区'].forEach((token) => assertIncludes(supplementDoc, token, `补料单缺少 ${token}`))

;[materialDoc, pickupDoc, issueDoc, supplementDoc].forEach((text, index) => {
  assertIncludes(text, 'targetRoute', `第 ${index + 1} 类单据二维码缺少 targetRoute`)
  assertNotIncludes(text, '系统占位图', `第 ${index + 1} 类单据不得显示系统占位图`)
  assertNotIncludes(text, '商品中心系统', `第 ${index + 1} 类单据不得显示商品中心系统导航`)
  assertNotIncludes(text, '采购管理系统', `第 ${index + 1} 类单据不得显示采购管理系统导航`)
})

assertNotIncludes(template, '数量：', '打印模板不得只写数量')
assertNotIncludes(template, '长度：', '打印模板不得只写长度')
assertNotIncludes(template, '领料数量', '领料单不得只写领料数量')
assertNotIncludes(template, '发料数量', '发料单不得只写发料数量')
assertNotIncludes(template, '补料数量', '补料单不得只写补料数量')

assertIncludes(read('src/pages/print/task-route-card.ts'), 'renderUnifiedPrintPreviewPage', '任务流转卡打印入口被破坏')
assertIncludes(read('src/pages/print/task-delivery-card.ts'), '任务交货卡', '任务交货卡打印入口被破坏')
assertIncludes(read('src/pages/production/confirmation-print.ts'), '生产确认单', '生产确认单入口被破坏')
assertIncludes(read('src/pages/process-factory/cutting/fei-tickets.ts'), '菲票', '菲票入口被破坏')
assertIncludes(read('src/pages/settlement/request-domain.ts'), '结算信息变更申请单', '结算信息变更申请单入口被破坏')

console.log('material pickup issue supplement print checks passed')
